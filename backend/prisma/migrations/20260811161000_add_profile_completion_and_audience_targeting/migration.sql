DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserGender') THEN
    CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignTargetGender') THEN
    CREATE TYPE "CampaignTargetGender" AS ENUM ('ALL', 'MALE', 'FEMALE');
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "gender" "UserGender",
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT;

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "targetGender" "CampaignTargetGender" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "targetCountry" TEXT NOT NULL DEFAULT 'WORLDWIDE';

CREATE INDEX IF NOT EXISTS "User_gender_countryCode_idx" ON "User"("gender", "countryCode");
CREATE INDEX IF NOT EXISTS "Campaign_targetGender_targetCountry_idx" ON "Campaign"("targetGender", "targetCountry");
