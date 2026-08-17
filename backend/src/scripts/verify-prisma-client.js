const { Prisma } = require('@prisma/client');

const REQUIRED_FIELDS = {
  User: ['gender', 'countryCode'],
  Campaign: ['targetGender', 'targetCountry'],
};

function main() {
  const models = new Map(
    Prisma.dmmf.datamodel.models.map((model) => [
      model.name,
      new Set(model.fields.map((field) => field.name)),
    ]),
  );

  const missing = [];
  for (const [modelName, fields] of Object.entries(REQUIRED_FIELDS)) {
    const knownFields = models.get(modelName);
    if (!knownFields) {
      missing.push(`${modelName} model missing from generated Prisma client`);
      continue;
    }

    for (const field of fields) {
      if (!knownFields.has(field)) {
        missing.push(`${modelName}.${field}`);
      }
    }
  }

  if (missing.length) {
    console.error('Prisma client is out of sync with the schema. Missing:', missing.join(', '));
    console.error('Run: npx prisma generate --schema=prisma/schema.prisma');
    process.exit(1);
  }

  console.log(
    `Prisma client verified for profile/audience fields (client ${Prisma.prismaVersion.client}).`,
  );
}

main();
