const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

function toPg(value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

async function queryFirst(prisma, sql, params = []) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params.map(toPg));
  return Array.isArray(rows) ? (rows[0] || null) : null;
}

function buildAppSettingDelegate(prisma) {
  return {
    async findUnique(args = {}) {
      const where = args.where || {};
      if (where.key !== undefined) {
        return queryFirst(
          prisma,
          'SELECT * FROM "AppSetting" WHERE "key" = $1 LIMIT 1',
          [where.key],
        );
      }
      if (where.id !== undefined) {
        return queryFirst(
          prisma,
          'SELECT * FROM "AppSetting" WHERE "id" = $1 LIMIT 1',
          [where.id],
        );
      }
      return null;
    },

    async create(args = {}) {
      const data = { id: crypto.randomUUID(), ...(args.data || {}) };
      const fields = Object.keys(data);
      const placeholders = fields
        .map((field, index) =>
          field === 'valueJson' ? `$${index + 1}::jsonb` : `$${index + 1}`,
        )
        .join(', ');
      const sql = `INSERT INTO "AppSetting" (${fields
        .map((field) => `"${field}"`)
        .join(', ')}, "createdAt", "updatedAt") VALUES (${placeholders}, NOW(), NOW()) RETURNING *`;
      const params = fields.map((field) =>
        field === 'valueJson' ? JSON.stringify(data[field]) : data[field],
      );
      return queryFirst(prisma, sql, params);
    },

    async upsert(args = {}) {
      const where = args.where || {};
      const createData = { id: crypto.randomUUID(), ...(args.create || {}) };
      const updateData = args.update || {};
      const key = where.key ?? createData.key;
      const valueJson = updateData.valueJson ?? createData.valueJson ?? {};
      return queryFirst(
        prisma,
        'INSERT INTO "AppSetting" ("id", "key", "valueJson", "createdAt", "updatedAt") VALUES ($1, $2, $3::jsonb, NOW(), NOW()) ON CONFLICT ("key") DO UPDATE SET "valueJson" = EXCLUDED."valueJson", "updatedAt" = NOW() RETURNING *',
        [createData.id, key, JSON.stringify(valueJson)],
      );
    },

    async update(args = {}) {
      const where = args.where || {};
      const data = args.data || {};
      const key = where.key;
      if (!key) {
        throw new Error('AppSetting raw update requires where.key');
      }
      return queryFirst(
        prisma,
        'UPDATE "AppSetting" SET "valueJson" = $2::jsonb, "updatedAt" = NOW() WHERE "key" = $1 RETURNING *',
        [key, JSON.stringify(data.valueJson ?? {})],
      );
    },
  };
}

function buildPointPackageDelegate(prisma) {
  return {
    async findUnique(args = {}) {
      const where = args.where || {};
      if (where.id !== undefined) {
        return queryFirst(
          prisma,
          'SELECT * FROM "PointPackage" WHERE "id" = $1 LIMIT 1',
          [where.id],
        );
      }
      if (where.slug !== undefined) {
        return queryFirst(
          prisma,
          'SELECT * FROM "PointPackage" WHERE "slug" = $1 LIMIT 1',
          [where.slug],
        );
      }
      return null;
    },

    async findMany(args = {}) {
      const where = args.where || {};
      const clauses = [];
      const params = [];
      if (where.isActive !== undefined) {
        params.push(!!where.isActive);
        clauses.push(`"isActive" = $${params.length}`);
      }
      const orderBy = Array.isArray(args.orderBy)
        ? args.orderBy
        : args.orderBy
          ? [args.orderBy]
          : [];
      const orderSql = orderBy.length
        ? ' ORDER BY ' + orderBy
            .flatMap((entry) =>
              Object.entries(entry).map(
                ([field, dir]) => `"${field}" ${String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`,
              ),
            )
            .join(', ')
        : '';
      const sql = `SELECT * FROM "PointPackage"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}${orderSql}`;
      return prisma.$queryRawUnsafe(sql, ...params.map(toPg));
    },

    async create(args = {}) {
      const data = { id: crypto.randomUUID(), ...(args.data || {}) };
      const fields = Object.keys(data);
      const sql = `INSERT INTO "PointPackage" (${fields
        .map((field) => `"${field}"`)
        .join(', ')}) VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`;
      return queryFirst(prisma, sql, fields.map((field) => data[field]));
    },

    async update(args = {}) {
      const where = args.where || {};
      const data = args.data || {};
      const keys = Object.keys(data);
      if (!where.id) {
        throw new Error('PointPackage raw update requires where.id');
      }
      if (!keys.length) {
        return this.findUnique({ where });
      }
      const sql = `UPDATE "PointPackage" SET ${keys
        .map((field, index) => `"${field}" = $${index + 2}`)
        .join(', ')} WHERE "id" = $1 RETURNING *`;
      return queryFirst(prisma, sql, [where.id, ...keys.map((field) => data[field])]);
    },

    async delete(args = {}) {
      const where = args.where || {};
      if (!where.id) {
        throw new Error('PointPackage raw delete requires where.id');
      }
      return queryFirst(
        prisma,
        'DELETE FROM "PointPackage" WHERE "id" = $1 RETURNING *',
        [where.id],
      );
    },

    async count(args = {}) {
      const where = args.where || {};
      const clauses = [];
      const params = [];
      if (where.isActive !== undefined) {
        params.push(!!where.isActive);
        clauses.push(`"isActive" = $${params.length}`);
      }
      const row = await queryFirst(
        prisma,
        `SELECT COUNT(*)::int AS count FROM "PointPackage"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}`,
        params,
      );
      return Number(row?.count || 0);
    },
  };
}

function attachFallbackDelegates(prisma) {
  if (!prisma.appSetting) {
    prisma.appSetting = buildAppSettingDelegate(prisma);
  }
  if (!prisma.pointPackage) {
    prisma.pointPackage = buildPointPackageDelegate(prisma);
  }
  return prisma;
}

const prisma = attachFallbackDelegates(
  global.__prisma ||
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    }),
);

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
