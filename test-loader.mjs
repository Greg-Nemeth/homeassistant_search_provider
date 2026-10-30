// test-loader.mjs
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('gi://') || specifier.startsWith('resource:///')) {
    return {
      shortCircuit: true,
      url: `mock:${encodeURIComponent(specifier)}`,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('mock:')) {
    const rawSpecifier = decodeURIComponent(url.slice(5));

    // Provide default stubs for standard GNOME namespaces
    let mockExport = `
      export default {};
      export const Extension = class {};
      export const Main = {};
    `;

    return {
      format: 'module',
      shortCircuit: true,
      source: mockExport,
    };
  }
  return nextLoad(url, context);
}
