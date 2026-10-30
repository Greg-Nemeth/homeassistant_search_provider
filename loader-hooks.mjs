// loader-hooks.mjs
const MOCK_SOURCE = encodeURIComponent(`
  export default {};
  export const Extension = class {};
  export const Main = {
    overview: {
      searchController: {
        addProvider: () => {},
        removeProvider: () => {}
      }
    }
  };
`);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('gi:') || specifier.startsWith('resource:')) {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${MOCK_SOURCE}`
    };
  }
  return nextResolve(specifier, context);
}
