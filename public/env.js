// Default runtime config for local dev / plain `ng serve`. In the Docker
// image this file is regenerated from docker/env.template.js at container
// start (see docker-entrypoint.sh), so it can point at a different backend
// per deployment without rebuilding the image.
window.__env = {
  apiBaseUrl: 'http://localhost:8080',
};
