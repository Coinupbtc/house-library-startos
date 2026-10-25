FROM alpine:3.22

RUN apk add --no-cache ca-certificates wget tini nginx

# kiwix-tools release tarballs. The binaries are statically linked.
# SHA256 is of the tarball from download.kiwix.org, not of a single binary.
ARG KIWIX_SHA_AMD64=b0ae98dd344aa0469a15ab42feff6d5aafb79541a82fb4e2647c74b073123815
ARG KIWIX_SHA_ARM64=a9898fc5363437327350db669bbc03dcc7ecfd498dae727d7184bebe77019514

ARG TARGETARCH
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) arch=x86_64; sum="$KIWIX_SHA_AMD64" ;; \
      arm64) arch=aarch64; sum="$KIWIX_SHA_ARM64" ;; \
      *) echo "unsupported TARGETARCH=$TARGETARCH" >&2; exit 1 ;; \
    esac; \
    if [ "$sum" = "pending" ]; then echo "arm64 tarball checksum is not pinned" >&2; exit 1; fi; \
    f="kiwix-tools_linux-${arch}-3.8.2.tar.gz"; \
    wget -O "/tmp/$f" "https://download.kiwix.org/release/kiwix-tools/$f"; \
    echo "$sum  /tmp/$f" | sha256sum -c -; \
    tar -xzf "/tmp/$f" -C /tmp; \
    install -m 0755 "/tmp/kiwix-tools_linux-${arch}-3.8.2/kiwix-serve" /usr/local/bin/kiwix-serve; \
    install -m 0755 "/tmp/kiwix-tools_linux-${arch}-3.8.2/kiwix-manage" /usr/local/bin/kiwix-manage; \
    rm -rf "/tmp/$f" "/tmp/kiwix-tools_linux-${arch}-3.8.2"; \
    kiwix-serve --version; \
    kiwix-manage --version

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY www /opt/house-library/www
COPY conf/nginx.conf /opt/house-library/nginx.conf
RUN chmod 0755 /usr/local/bin/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
