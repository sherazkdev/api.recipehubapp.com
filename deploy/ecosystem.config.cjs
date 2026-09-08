module.exports = {
  apps: [
    {
      name: "recipe-hub-api",
      script: "npm",
      args: "start",
      cwd: "/var/www/recipe-hub-api",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3013,
      },
    },
  ],
};
