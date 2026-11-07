import { randomUUID } from 'node:crypto';

// A small in-memory stand-in for drizzle-orm + @adaptivegate/db, just
// faithful enough (real filtering by table/condition) to prove the REST
// routes build the right ownership-scoped WHERE clauses — not a general
// drizzle emulator. Tables are referenced by object identity, same as real
// drizzle table objects.

export type Row = Record<string, unknown>;

type Condition =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'isNull'; column: string }
  | { type: 'and'; conditions: Condition[] };

export function eq(column: string, value: unknown): Condition {
  return { type: 'eq', column, value };
}
export function isNull(column: string): Condition {
  return { type: 'isNull', column };
}
export function and(...conditions: Condition[]): Condition {
  return { type: 'and', conditions };
}

interface DescMarker {
  __desc: string;
}
export function desc(column: string): DescMarker {
  return { __desc: column };
}

function defaultCompare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  return (a as number | Date) < (b as number | Date) ? -1 : 1;
}

function matches(row: Row, condition?: Condition): boolean {
  if (!condition) return true;
  if (condition.type === 'eq') return row[condition.column] === condition.value;
  if (condition.type === 'isNull') return row[condition.column] == null;
  return condition.conditions.every((c) => matches(row, c));
}

function project(row: Row, selection?: Record<string, string>): Row {
  if (!selection) return { ...row };
  return Object.fromEntries(Object.entries(selection).map(([outKey, col]) => [outKey, row[col]]));
}

export function makeColumns<T extends string>(names: T[]): Record<T, string> {
  return Object.fromEntries(names.map((name) => [name, name])) as unknown as Record<T, string>;
}

export function createFakeDb(tables: Map<object, Row[]>) {
  const rowsOf = (table: object): Row[] => {
    const rows = tables.get(table);
    if (!rows) throw new Error('unknown fake table');
    return rows;
  };
  const setRowsOf = (table: object, rows: Row[]) => tables.set(table, rows);

  return {
    select(selection?: Record<string, string>) {
      return {
        from(table: object) {
          return {
            where: (condition?: Condition) => {
              const filtered = rowsOf(table).filter((r) => matches(r, condition));
              const projected = filtered.map((r) => project(r, selection));
              return {
                then: (resolve: (v: Row[]) => unknown, reject?: (e: unknown) => unknown) =>
                  Promise.resolve(projected).then(resolve, reject),
                // Only `desc` is supported — no fake table here needs `asc`.
                orderBy: (marker: DescMarker) =>
                  Promise.resolve(
                    [...filtered]
                      .sort((a, b) => -defaultCompare(a[marker.__desc], b[marker.__desc]))
                      .map((r) => project(r, selection)),
                  ),
              };
            },
          };
        },
      };
    },
    insert(table: object) {
      return {
        values(values: Row) {
          return {
            returning: (selection?: Record<string, string>) => {
              const row: Row = {
                id: randomUUID(),
                createdAt: new Date(),
                revokedAt: null,
                ...values,
              };
              setRowsOf(table, [...rowsOf(table), row]);
              return Promise.resolve([project(row, selection)]);
            },
          };
        },
      };
    },
    update(table: object) {
      return {
        set(values: Row) {
          return {
            where(condition?: Condition) {
              return {
                returning: (selection?: Record<string, string>) => {
                  const updated: Row[] = [];
                  setRowsOf(
                    table,
                    rowsOf(table).map((r) => {
                      if (!matches(r, condition)) return r;
                      const next = { ...r, ...values };
                      updated.push(next);
                      return next;
                    }),
                  );
                  return Promise.resolve(updated.map((r) => project(r, selection)));
                },
              };
            },
          };
        },
      };
    },
    delete(table: object) {
      return {
        where(condition?: Condition) {
          return {
            returning: (selection?: Record<string, string>) => {
              const removed: Row[] = [];
              setRowsOf(
                table,
                rowsOf(table).filter((r) => {
                  if (!matches(r, condition)) return true;
                  removed.push(r);
                  return false;
                }),
              );
              return Promise.resolve(removed.map((r) => project(r, selection)));
            },
          };
        },
      };
    },
  };
}
