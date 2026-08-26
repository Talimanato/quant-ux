import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface Query {
  [key: string]: any;
}

export interface FindOptions {
  fields?: string[];
  sort?: { [key: string]: 1 | -1 };
  limit?: number;
  offset?: number;
}

export class SQLiteClient {
  private columnCache: Map<string, Set<string>> = new Map();

  constructor(private db: Database.Database) {}

  private static readonly BOOLEAN_COLUMNS = new Set([
    'isPublic', 'clonable', 'isDirty', 'isDeleted', 'tos', 'acceptedGDPR',
    'acceptedTOS', 'acceptedPrivacy', 'acceptedAI', 'newsletter', 'read'
  ]);

  private getColumns(table: string): Set<string> {
    if (!this.columnCache.has(table)) {
      const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      this.columnCache.set(table, new Set(columns.map((c) => c.name)));
    }
    return this.columnCache.get(table)!;
  }

  private filterColumns(table: string, data: any): any {
    const columns = this.getColumns(table);
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === '_id') {
        if (columns.has('id')) result.id = value;
      } else if (columns.has(key)) {
        result[key] = value;
      }
    }
    return result;
  }

  private cleanJson(json: any): any {
    if (!json) return json;
    const result = { ...json };
    if (result._id !== undefined) {
      result.id = result._id;
    }
    return result;
  }

  private serializeParam(value: any): any {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  private buildWhereClause(table: string, query: Query): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    const columns = this.getColumns(table);

    for (const [key, value] of Object.entries(query)) {
      if (key === '_id' || key === 'id') {
        const column = 'id';
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if ('$in' in value) {
            const placeholders = value.$in.map(() => '?').join(',');
            conditions.push(`${column} IN (${placeholders})`);
            params.push(...value.$in.map((v: any) => this.serializeParam(v)));
            continue;
          }
        }
        conditions.push(`${column} = ?`);
        params.push(this.serializeParam(value));
        continue;
      } else if (!columns.has(key)) {
        // skip columns that don't exist yet
        continue;
      } else if (typeof value === 'object' && value !== null) {
        if ('$in' in value) {
          const placeholders = value.$in.map(() => '?').join(',');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...value.$in.map((v: any) => this.serializeParam(v)));
        } else if ('$ne' in value) {
          conditions.push(`${key} != ?`);
          params.push(this.serializeParam(value.$ne));
        } else if ('$gt' in value) {
          conditions.push(`${key} > ?`);
          params.push(this.serializeParam(value.$gt));
        } else if ('$gte' in value) {
          conditions.push(`${key} >= ?`);
          params.push(this.serializeParam(value.$gte));
        } else if ('$lt' in value) {
          conditions.push(`${key} < ?`);
          params.push(this.serializeParam(value.$lt));
        } else if ('$lte' in value) {
          conditions.push(`${key} <= ?`);
          params.push(this.serializeParam(value.$lte));
        } else if ('$exists' in value) {
          if (value.$exists) {
            conditions.push(`${key} IS NOT NULL`);
          } else {
            conditions.push(`${key} IS NULL`);
          }
        } else if ('$regex' in value) {
          conditions.push(`${key} LIKE ?`);
          params.push(`%${value.$regex}%`);
        } else {
          conditions.push(`${key} = ?`);
          params.push(this.serializeParam(value));
        }
      } else {
        conditions.push(`${key} = ?`);
        params.push(this.serializeParam(value));
      }
    }

    const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { sql, params };
  }

  private buildSelectFields(table: string, options?: FindOptions): string {
    if (options?.fields && options.fields.length > 0) {
      return options.fields.join(', ');
    }
    return '*';
  }

  private buildOrderBy(options?: FindOptions): string {
    if (!options?.sort) return '';
    const clauses = Object.entries(options.sort).map(([key, dir]) => {
      return `${key} ${dir === 1 ? 'ASC' : 'DESC'}`;
    });
    return `ORDER BY ${clauses.join(', ')}`;
  }

  findOne(table: string, query: Query, options?: FindOptions): any | null {
    const { sql: whereSql, params } = this.buildWhereClause(table, query);
    const fields = this.buildSelectFields(table, options);
    const sql = `SELECT ${fields} FROM ${table} ${whereSql} LIMIT 1`;
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    if (!row) return null;
    return this.cleanJson(this.deserializeRow(row));
  }

  find(table: string, query: Query, options?: FindOptions): any[] {
    const { sql: whereSql, params } = this.buildWhereClause(table, query);
    const fields = this.buildSelectFields(table, options);
    const orderBy = this.buildOrderBy(options);
    const limit = options?.limit ? `LIMIT ${options.limit}` : '';
    const offset = options?.offset ? `OFFSET ${options.offset}` : '';
    const sql = `SELECT ${fields} FROM ${table} ${whereSql} ${orderBy} ${limit} ${offset}`;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.cleanJson(this.deserializeRow(row)));
  }

  count(table: string, query: Query): number {
    const { sql: whereSql, params } = this.buildWhereClause(table, query);
    const sql = `SELECT COUNT(*) as count FROM ${table} ${whereSql}`;
    const stmt = this.db.prepare(sql);
    const row: any = stmt.get(...params);
    return row.count;
  }

  insert(table: string, json: any): string {
    const id = json._id || json.id || uuidv4();
    const data: any = { ...json, id };
    delete data._id;
    const filtered = this.filterColumns(table, data);
    const columns = Object.keys(filtered);
    const placeholders = columns.map(() => '?').join(',');
    const values = columns.map((col) => this.serializeValue(filtered[col]));
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);
    return id;
  }

  save(table: string, json: any): string {
    const id = json._id || json.id;
    if (!id) {
      return this.insert(table, json);
    }

    const existing = this.findOne(table, { _id: id });
    if (existing) {
      return this.updateCollection(table, { _id: id }, { $set: json });
    }
    return this.insert(table, json);
  }

  updateCollection(table: string, query: Query, update: { $set?: any; $inc?: any; $push?: any }): string {
    const { sql: whereSql, params: whereParams } = this.buildWhereClause(table, query);
    const columns = this.getColumns(table);
    const set: any = this.filterColumns(table, update.$set || {});

    const setColumns: string[] = [];
    const setValues: any[] = [];

    for (const [key, value] of Object.entries(set)) {
      if (key === '_id' || key === 'id') continue;
      if (!columns.has(key)) continue;
      setColumns.push(`${key} = ?`);
      setValues.push(this.serializeValue(value));
    }

    if (setColumns.length === 0 && !update.$inc) {
      return query._id || query.id;
    }

    if (update.$inc) {
      for (const [key, value] of Object.entries(update.$inc)) {
        setColumns.push(`${key} = ${key} + ?`);
        setValues.push(value);
      }
    }

    const sql = `UPDATE ${table} SET ${setColumns.join(', ')} ${whereSql}`;
    const stmt = this.db.prepare(sql);
    stmt.run(...setValues, ...whereParams);
    return query._id || query.id;
  }

  removeDocuments(table: string, query: Query): number {
    const { sql: whereSql, params } = this.buildWhereClause(table, query);
    const sql = `DELETE FROM ${table} ${whereSql}`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  }

  findBatch(table: string, query: Query): IterableIterator<any> {
    const { sql: whereSql, params } = this.buildWhereClause(table, query);
    const sql = `SELECT * FROM ${table} ${whereSql}`;
    const stmt = this.db.prepare(sql);
    const rows = stmt.iterate(...params);
    return (function* () {
      for (const row of rows) {
        yield row;
      }
    })();
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  private serializeValue(value: any): any {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  private deserializeRow(row: any): any {
    const result: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id') {
        result._id = value;
        result.id = value;
      } else if (SQLiteClient.BOOLEAN_COLUMNS.has(key)) {
        result[key] = value === 1 || value === true;
      } else if (key === 'data' || key === 'screenSize' || key === 'has' || key === 'notifications') {
        if (typeof value === 'string') {
          try {
            result[key] = JSON.parse(value);
          } catch (e) {
            result[key] = value;
          }
        } else {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
