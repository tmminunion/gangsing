module.exports = {
  apps: [
    {
      name: 'gangsing-relay',
      script: 'npm',
      args: 'run relay',
      cwd: '/home/nunu/gangsing',
      env: {
        SIGN_API_KEY: 'euler_MWNkMzEwYzdhYmRjYzJmMTQ2YWI0ODA4YzQwNmVhN2I4Y2FkZTVhMGRlZTAxM2RjNjk4N2I5',
      }
    },
    {
      name: 'gangsing-ui',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/nunu/gangsing',
    }
  ]
};
