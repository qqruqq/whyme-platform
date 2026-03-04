-- CreateEnum
CREATE TYPE "slot_status" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "group_status" AS ENUM ('pending_info', 'pending_payment', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "roster_status" AS ENUM ('draft', 'collecting', 'locked', 'completed');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('pending', 'completed', 'removed');

-- CreateEnum
CREATE TYPE "payment_type" AS ENUM ('deposit', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('unpaid', 'paid', 'refunded', 'partial');

-- CreateEnum
CREATE TYPE "invite_purpose" AS ENUM ('roster_entry', 'leader_only');

-- CreateEnum
CREATE TYPE "internal_user_role" AS ENUM ('super_admin', 'admin', 'instructor');

-- CreateEnum
CREATE TYPE "internal_user_status" AS ENUM ('pending', 'active', 'suspended', 'deleted');

-- CreateTable
CREATE TABLE "reservation_slot" (
    "slot_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "status" "slot_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_slot_pkey" PRIMARY KEY ("slot_id")
);

-- CreateTable
CREATE TABLE "parent" (
    "parent_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "kakao_id" TEXT,
    "cash_receipt_number" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_pkey" PRIMARY KEY ("parent_id")
);

-- CreateTable
CREATE TABLE "group_pass" (
    "group_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slot_id" UUID NOT NULL,
    "leader_parent_id" UUID NOT NULL,
    "headcount_min" SMALLINT NOT NULL DEFAULT 2,
    "headcount_max" SMALLINT NOT NULL DEFAULT 6,
    "headcount_declared" SMALLINT,
    "headcount_final" SMALLINT,
    "roster_status" "roster_status" NOT NULL DEFAULT 'draft',
    "status" "group_status" NOT NULL DEFAULT 'pending_info',
    "memo_to_instructor" TEXT,
    "naver_reservation_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_pass_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "invite_link" (
    "invite_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "purpose" "invite_purpose" NOT NULL DEFAULT 'roster_entry',
    "expires_at" TIMESTAMPTZ,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ,
    "used_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_link_pkey" PRIMARY KEY ("invite_id")
);

-- CreateTable
CREATE TABLE "child" (
    "child_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "prior_student_attended" BOOLEAN,
    "siblings_prior_attended" BOOLEAN,
    "parent_prior_attended" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_pkey" PRIMARY KEY ("child_id")
);

-- CreateTable
CREATE TABLE "group_member" (
    "group_member_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "parent_name" TEXT,
    "parent_phone" TEXT,
    "note_to_instructor" TEXT,
    "edit_token" TEXT,
    "status" "member_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_member_pkey" PRIMARY KEY ("group_member_id")
);

-- CreateTable
CREATE TABLE "payment" (
    "payment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "type" "payment_type" NOT NULL DEFAULT 'deposit',
    "amount" BIGINT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payer_name" TEXT,
    "memo" TEXT,
    "status" "payment_status" NOT NULL DEFAULT 'paid',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "internal_user" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "internal_user_role" NOT NULL,
    "status" "internal_user_status" NOT NULL DEFAULT 'active',
    "login_id" TEXT,
    "password_hash" TEXT,
    "instructor_code_hash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "internal_user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "internal_user_session" (
    "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_user_session_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE INDEX "reservation_slot_start_at_idx" ON "reservation_slot"("start_at");

-- CreateIndex
CREATE INDEX "reservation_slot_instructor_id_idx" ON "reservation_slot"("instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_phone_key" ON "parent"("phone");

-- CreateIndex
CREATE INDEX "group_pass_slot_id_idx" ON "group_pass"("slot_id");

-- CreateIndex
CREATE INDEX "group_pass_leader_parent_id_idx" ON "group_pass"("leader_parent_id");

-- CreateIndex
CREATE INDEX "group_pass_status_roster_status_idx" ON "group_pass"("status", "roster_status");

-- CreateIndex
CREATE UNIQUE INDEX "invite_link_token_key" ON "invite_link"("token");

-- CreateIndex
CREATE INDEX "invite_link_group_id_idx" ON "invite_link"("group_id");

-- CreateIndex
CREATE INDEX "invite_link_token_idx" ON "invite_link"("token");

-- CreateIndex
CREATE UNIQUE INDEX "group_member_edit_token_key" ON "group_member"("edit_token");

-- CreateIndex
CREATE INDEX "group_member_group_id_idx" ON "group_member"("group_id");

-- CreateIndex
CREATE INDEX "group_member_status_idx" ON "group_member"("status");

-- CreateIndex
CREATE UNIQUE INDEX "group_member_group_id_child_id_key" ON "group_member"("group_id", "child_id");

-- CreateIndex
CREATE INDEX "payment_group_id_idx" ON "payment"("group_id");

-- CreateIndex
CREATE INDEX "payment_occurred_at_idx" ON "payment"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "internal_user_login_id_key" ON "internal_user"("login_id");

-- CreateIndex
CREATE INDEX "internal_user_role_status_idx" ON "internal_user"("role", "status");

-- CreateIndex
CREATE INDEX "internal_user_name_idx" ON "internal_user"("name");

-- CreateIndex
CREATE UNIQUE INDEX "internal_user_session_token_hash_key" ON "internal_user_session"("token_hash");

-- CreateIndex
CREATE INDEX "internal_user_session_user_id_idx" ON "internal_user_session"("user_id");

-- CreateIndex
CREATE INDEX "internal_user_session_expires_at_idx" ON "internal_user_session"("expires_at");

-- AddForeignKey
ALTER TABLE "group_pass" ADD CONSTRAINT "group_pass_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "reservation_slot"("slot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_pass" ADD CONSTRAINT "group_pass_leader_parent_id_fkey" FOREIGN KEY ("leader_parent_id") REFERENCES "parent"("parent_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group_pass"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group_pass"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("child_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group_pass"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_user_session" ADD CONSTRAINT "internal_user_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "internal_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

