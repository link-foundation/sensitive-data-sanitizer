declare const plugin: {
  rules: Record<
    string,
    {
      meta: object;
      create(context: any): Record<string, (...args: any[]) => void>;
    }
  >;
};
export default plugin;
