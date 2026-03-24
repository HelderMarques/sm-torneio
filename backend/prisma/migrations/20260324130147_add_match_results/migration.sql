-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "round_id" TEXT NOT NULL,
    "court_label" TEXT,
    "pair_a_id" TEXT NOT NULL,
    "pair_b_id" TEXT NOT NULL,
    "score_a" INTEGER NOT NULL,
    "score_b" INTEGER NOT NULL,
    "game_order" INTEGER NOT NULL,
    CONSTRAINT "match_results_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
