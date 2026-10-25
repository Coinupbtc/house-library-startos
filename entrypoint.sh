#!/bin/sh
# Serve the verified books, then download the rest of the chosen shelf in the
# background. main.ts writes /data/house/wanted.tsv (the books the owner chose,
# smallest first) and /data/house/shelf.json (what the home page shows) before
# this starts. kiwix-serve watches library.xml, so a book that finishes joins
# the library without a restart.
set -eu

ZIM=/data/zim
HOUSE=/data/house
LIB=$HOUSE/library.xml
STATUS=$HOUSE/status
WWW=/opt/house-library/www
PORT=8080
KIWIX_PORT=8081
RETRY_SECONDS=600
REV=${HOUSE_SHELF_REV:-none}
TAB=$(printf '\t')
WANTED=/tmp/wanted.tsv
SERVE_PID=
NGINX_PID=
WPID=
SPID=

mkdir -p "$ZIM" "$HOUSE"

# Work from a copy: main.ts may rewrite the list while this run is going.
HAVE_LIST=0
if [ -f "$HOUSE/wanted.tsv" ]; then
  cp "$HOUSE/wanted.tsv" "$WANTED"
  HAVE_LIST=1
else
  echo "library: no book list yet; serving what is on disk"
  : > "$WANTED"
fi
TOTAL=$(grep -c . "$WANTED" || true)

on_term() {
  for pid in "${WPID:-}" "${SPID:-}" "${NGINX_PID:-}" "${SERVE_PID:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit 0
}
trap on_term TERM INT

is_wanted() {
  cut -f1 "$WANTED" | grep -Fxq -- "$1"
}

# file [sha256] — finished and checked. Without a sum, any stamp counts; that
# is how a book that is no longer wanted keeps being served until it is removed.
verified() {
  [ -f "$ZIM/$1" ] && [ -f "$ZIM/$1.sha256" ] || return 1
  [ -z "${2:-}" ] || [ "$(cat "$ZIM/$1.sha256")" = "$2" ]
}

count_ready() {
  n=0
  while IFS="$TAB" read -r file url sum bytes title; do
    if verified "$file" "$sum"; then n=$((n + 1)); fi
  done < "$WANTED"
  echo "$n"
}

# Key=value lines for the Books health check in main.ts.
CUR= STAGE= CUR_BYTES=0 CUR_TOTAL=0 WAITING= NOSPACE= BADSUM=
write_status() {
  {
    echo "rev=$REV"
    echo "total=$TOTAL"
    echo "ready=$(count_ready)"
    [ -z "$CUR" ] || printf 'current=%s\nstage=%s\ncurrent_bytes=%s\ncurrent_total=%s\n' \
      "$CUR" "$STAGE" "$CUR_BYTES" "$CUR_TOTAL"
    [ -z "$WAITING" ] || echo "waiting=$WAITING"
    [ -z "$NOSPACE" ] || echo "nospace=$NOSPACE"
    [ -z "$BADSUM" ] || echo "badsum=$BADSUM"
  } > "$STATUS.tmp"
  mv -f "$STATUS.tmp" "$STATUS"
}

# The home page is a template with the shelf data spliced in at a marker line.
build_home() {
  {
    sed '/^@@SHELF@@$/,$d' "$WWW/home.html"
    if [ -f "$HOUSE/shelf.json" ]; then cat "$HOUSE/shelf.json"; else echo '[]'; fi
    echo
    sed '1,/^@@SHELF@@$/d' "$WWW/home.html"
  } > "$HOUSE/index.html"
}

# Every checked book on disk, written to a new file and swapped in whole.
rebuild_library() {
  printf '<library version="20110515">\n</library>\n' > "$LIB.tmp"
  for book in "$ZIM"/*.zim; do
    [ -f "$book" ] || continue
    if verified "$(basename "$book")"; then
      kiwix-manage "$LIB.tmp" add "$book" > /dev/null 2>&1 ||
        echo "library: kiwix-manage could not read $(basename "$book")"
    fi
  done
  mv -f "$LIB.tmp" "$LIB"
}

# Delete books that are no longer chosen. The library drops them first, so the
# reader stops linking to them before the files go.
prune_unwanted() {
  [ "$HAVE_LIST" = 1 ] || return 0
  trash=$ZIM/.removing
  mkdir -p "$trash"
  for f in "$ZIM"/*.zim "$ZIM"/*.zim.partial "$ZIM"/*.zim.sha256; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    name=${base%.partial}
    name=${name%.sha256}
    if ! is_wanted "$name"; then
      echo "library: removing $base"
      mv -f "$f" "$trash/"
    fi
  done
  rebuild_library
  sleep 3
  rm -rf "$trash"
}

check_reader() {
  if ! kill -0 "$SERVE_PID" 2>/dev/null || ! kill -0 "$NGINX_PID" 2>/dev/null; then
    echo "library: the reader stopped; exiting so StartOS restarts the service"
    exit 1
  fi
}

# file url sha256 bytes title
sync_one() {
  file=$1 url=$2 sum=$3 bytes=$4 title=$5
  final=$ZIM/$file
  partial=$final.partial
  stamp=$final.sha256
  CUR=$title CUR_TOTAL=$bytes CUR_BYTES=0

  if [ -f "$final" ]; then
    echo "library: checking existing $file"
    STAGE=checking
    write_status
    if echo "$sum  $final" | sha256sum -c - > /dev/null 2>&1; then
      printf '%s\n' "$sum" > "$stamp"
      return 0
    fi
    echo "library: existing $file failed its checksum"
    rm -f "$final" "$stamp"
  fi

  # Room for the rest of the file plus 1 GiB, counting what is already here.
  have=$(stat -c %s "$partial" 2>/dev/null || echo 0)
  need_kib=$(( (bytes - have) / 1024 + 1048576 ))
  avail=$(df -Pk "$ZIM" | awk 'NR==2 {print $4}')
  if [ "$avail" -lt "$need_kib" ]; then
    prune_unwanted
    avail=$(df -Pk "$ZIM" | awk 'NR==2 {print $4}')
  fi
  if [ "$avail" -lt "$need_kib" ]; then
    echo "library: not enough free disk for $file (need ${need_kib} KiB, have ${avail} KiB)"
    NOSPACE=$title
    return 1
  fi

  echo "library: downloading $file"
  STAGE=downloading
  wget -q -c --timeout=30 --tries=20 --retry-connrefused -O "$partial" "$url" &
  WPID=$!
  # Status every 2 s so small books move on quickly; a log line every 30 s.
  tick=0
  while kill -0 "$WPID" 2>/dev/null; do
    CUR_BYTES=$(stat -c %s "$partial" 2>/dev/null || echo 0)
    if [ $((tick % 15)) -eq 0 ]; then
      echo "library: $file bytes=$CUR_BYTES of $bytes"
      check_reader
    fi
    write_status
    tick=$((tick + 1))
    sleep 2 &
    SPID=$!
    wait "$SPID" || true
    SPID=
  done
  if ! wait "$WPID"; then
    WPID=
    echo "library: download failed for $file"
    return 1
  fi
  WPID=

  echo "library: checksum $file"
  STAGE=checking
  write_status
  if ! echo "$sum  $partial" | sha256sum -c - > /dev/null 2>&1; then
    echo "library: checksum failed for $file"
    rm -f "$partial"
    echo x >> "/tmp/badsum.$file"
    return 1
  fi
  mv -f "$partial" "$final"
  printf '%s\n' "$sum" > "$stamp"
  sync
  echo "library: $file ready"
  rebuild_library
}

build_home
rebuild_library
echo "library: serving on port $PORT; $(count_ready) of $TOTAL chosen books are ready"
kiwix-serve --port="$KIWIX_PORT" --address=127.0.0.1 --library --monitorLibrary \
  --nodatealiases --skipInvalid --customIndex="$HOUSE/index.html" "$LIB" &
SERVE_PID=$!
mkdir -p /tmp/nginx
nginx -c /opt/house-library/nginx.conf -g 'daemon off;' &
NGINX_PID=$!
write_status

while :; do
  WAITING= NOSPACE= BADSUM=
  # Read the list on its own descriptor so wget and kiwix-manage cannot eat it.
  while IFS="$TAB" read -r file url sum bytes title <&3; do
    verified "$file" "$sum" && continue
    # Two bad downloads of the same file: stop fetching it until the next start.
    if [ "$(cat "/tmp/badsum.$file" 2>/dev/null | wc -l)" -ge 2 ]; then
      BADSUM=${BADSUM:+$BADSUM, }$title
      continue
    fi
    if ! sync_one "$file" "$url" "$sum" "$bytes" "$title"; then
      WAITING=${WAITING:+$WAITING, }$title
    fi
    CUR= STAGE=
    write_status
  done 3< "$WANTED"

  if [ -z "$WAITING" ] && [ -z "$BADSUM" ]; then
    prune_unwanted
    write_status
    echo "library: all $TOTAL chosen books are ready"
    break
  fi
  if [ -z "$WAITING" ]; then
    echo "library: gave up on $BADSUM until the next start"
    write_status
    break
  fi
  echo "library: will try again in $((RETRY_SECONDS / 60)) minutes: $WAITING"
  write_status
  sleep "$RETRY_SECONDS" &
  SPID=$!
  wait "$SPID" || true
  SPID=
  check_reader
done

# Exit when either server stops, so StartOS restarts the service.
while kill -0 "$SERVE_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 10 &
  SPID=$!
  wait "$SPID" || true
done
check_reader
