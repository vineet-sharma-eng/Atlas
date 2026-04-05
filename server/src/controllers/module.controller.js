const MODULES = [
  { id: 'gym', name: 'Workout' },
  { id: 'finance', name: 'Finance' },
];

function listModules(req, res) {
  return res.status(200).json({
    modules: MODULES,
  });
}

module.exports = {
  listModules,
};
