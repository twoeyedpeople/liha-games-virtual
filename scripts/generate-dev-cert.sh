#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/certs"
KEY_FILE="${CERT_DIR}/dev-key.pem"
CERT_FILE="${CERT_DIR}/dev-cert.pem"
CFG_FILE="${CERT_DIR}/openssl-san.cnf"

mkdir -p "${CERT_DIR}"

detect_lan_ip() {
  node -e 'const os=require("os"); const nets=os.networkInterfaces(); for (const list of Object.values(nets)) { for (const n of (list||[])) { if (n && n.family==="IPv4" && !n.internal) { console.log(n.address); process.exit(0);} } }'
}

LAN_IP="${1:-$(detect_lan_ip)}"
if [[ -z "${LAN_IP}" ]]; then
  LAN_IP="127.0.0.1"
fi

cat > "${CFG_FILE}" <<EOF
[ req ]
default_bits       = 2048
prompt             = no
default_md         = sha256
x509_extensions    = v3_req
distinguished_name = dn

[ dn ]
CN = ${LAN_IP}

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ${LAN_IP}
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -days 365 \
  -config "${CFG_FILE}" \
  -extensions v3_req

echo "Generated:"
echo "  ${KEY_FILE}"
echo "  ${CERT_FILE}"
echo ""
echo "LAN IP included in cert SAN: ${LAN_IP}"
echo "Start server with: npm start"
