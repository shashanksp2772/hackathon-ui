#!/bin/sh
set -e

# Regenerate env.js from the API_BASE_URL passed into the container, so the
# same built image can point at a different backend per deployment.
export API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
envsubst '${API_BASE_URL}' < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js

exec nginx -g 'daemon off;'
