CREATE TABLE "conversations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_fk" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "conversations_product_fk_fkey" FOREIGN KEY ("product_fk") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "conversation_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversation_fk" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_messages_conversation_fk_fkey" FOREIGN KEY ("conversation_fk") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "conversations_product_fk_user_id_key" ON "conversations"("product_fk", "user_id");
CREATE INDEX "conversations_user_id_updated_at_idx" ON "conversations"("user_id", "updated_at");
CREATE INDEX "conversations_product_fk_idx" ON "conversations"("product_fk");
CREATE INDEX "conversation_messages_conversation_fk_created_at_idx" ON "conversation_messages"("conversation_fk", "created_at");
CREATE INDEX "conversation_messages_sender_id_read_at_idx" ON "conversation_messages"("sender_id", "read_at");
