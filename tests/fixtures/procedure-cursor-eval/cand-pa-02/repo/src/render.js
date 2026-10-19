function renderReport(reportId) {
  return `Report ${reportId} generated at ${new Date().toISOString()}`;
}

module.exports = { renderReport };
