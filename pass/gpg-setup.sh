#!/usr/bin/env bash
# Configura GPG y Pass para usar en Docker con Proton Suite Agent.
# Crea una clave GPG sin passphrase e inicializa el password store.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== GPG + Pass setup for Docker ==="
echo ""

# 1. Verificar que los volúmenes existen
if ! docker volume ls --format '{{.Name}}' | grep -q '^pass-data$'; then
  echo "Creating pass-data volume..."
  docker volume create pass-data
fi
if ! docker volume ls --format '{{.Name}}' | grep -q '^gnupg-data$'; then
  echo "Creating gnupg-data volume..."
  docker volume create gnupg-data
fi

# 2. Generar clave GPG dentro del contenedor
echo ""
echo "Generating GPG key (no passphrase)..."
docker compose run --rm --entrypoint="" agent bash -c "
  export GNUPGHOME=/home/node/.gnupg
  mkdir -p /home/node/.gnupg
  chmod 700 /home/node/.gnupg
  cat > /tmp/gpg-batch << 'EOF'
Key-Type: default
Subkey-Type: default
Name-Real: Proton Suite Agent
Name-Email: protonsuite@localhost
Expire-Date: 0
Passphrase: ''
%commit
EOF
  gpg --batch --generate-key /tmp/gpg-batch
  gpg --list-keys
"

# 3. Obtener el fingerprint de la clave generada
FINGERPRINT=$(docker compose run --rm --entrypoint="" agent bash -c "
  export GNUPGHOME=/home/node/.gnupg
  gpg --list-keys --with-colons | grep '^fpr:' | head -1 | cut -d: -f10
")
echo ""
echo "GPG key fingerprint: $FINGERPRINT"

# 4. Inicializar password store
echo ""
echo "Initializing pass store..."
docker compose run --rm --entrypoint="" agent bash -c "
  export GNUPGHOME=/home/node/.gnupg
  export PASSWORD_STORE_DIR=/home/node/.password-store
  pass init $FINGERPRINT
"

# 5. Insertar contraseña de Bridge
echo ""
echo "Inserting Bridge password into Pass store..."
echo -n "Enter your Bridge password: "
read -rs BRIDGE_PASS
echo ""
echo "$BRIDGE_PASS" | docker compose run --rm --entrypoint="" -i agent bash -c "
  export GNUPGHOME=/home/node/.gnupg
  export PASSWORD_STORE_DIR=/home/node/.password-store
  pass insert --multiline proton/bridge/password
"

# 6. Verificar
echo ""
echo "Verifying Pass store..."
docker compose run --rm --entrypoint="" agent bash -c "
  export GNUPGHOME=/home/node/.gnupg
  export PASSWORD_STORE_DIR=/home/node/.password-store
  pass ls
"

echo ""
echo "=== Done ==="
echo "Add to your docker compose environment:"
echo "  PROTON_BRIDGE_PASS_PATH=proton/bridge/password"
echo "  PROTON_PASS_ENABLED=true"
echo ""
echo "And uncomment the pass-data and gnupg-data volume mounts in docker-compose.yml."
