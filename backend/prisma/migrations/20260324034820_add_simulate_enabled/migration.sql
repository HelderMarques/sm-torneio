-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tournaments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "total_rounds" INTEGER NOT NULL DEFAULT 9,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "simulate_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_tournaments" ("created_at", "id", "name", "slug", "status", "total_rounds", "year") SELECT "created_at", "id", "name", "slug", "status", "total_rounds", "year" FROM "tournaments";
DROP TABLE "tournaments";
ALTER TABLE "new_tournaments" RENAME TO "tournaments";
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
