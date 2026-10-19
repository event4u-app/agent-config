function importSupplierFeed(depot) {
  console.log(`importing stock feed for ${depot}`);
  return { depot, imported: 0 };
}

module.exports = { importSupplierFeed };
