function getPythonPath() {
  if (IS_PROD) {
    if (fs.existsSync(PYTHON_EMBED)) return PYTHON_EMBED;
    if (fs.existsSync(PYTHON_VENV))  return PYTHON_VENV;
    return 'python'; // fallback
  }
  // dev: 32bit Python ?°μ„  (Kiwoom OpenAPI ?Έν™)
  const python32 = 'C:\\Python39_32\\python.exe';
  if (fs.existsSync(python32)) return python32;
  // venv
  const devVenv = path.join(__dirname, '..', 'backend', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(devVenv)) return devVenv;
  return process.env.ROADFLOW_PYTHON || 'python';
}
