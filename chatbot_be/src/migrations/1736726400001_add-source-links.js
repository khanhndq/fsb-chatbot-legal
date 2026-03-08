export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumn('messages', {
    source_links: {
      type: 'jsonb',
      notNull: false,
      default: null,
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('messages', 'source_links', { ifExists: true });
};
