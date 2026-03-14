/**
 * @swagger
 * tags:
 *   - name: User - Self Repurchase Bonus
 *     description: Self Repurchase Bonus tracking — eligibility window status for authenticated users
 *   - name: Admin - Self Repurchase Bonus
 *     description: Admin management of the Self Repurchase Bonus pool and distribution (Admin Access Only)
 */

/**
 * @swagger
 * /api/v1/user/self-repurchase-bonus/status:
 *   get:
 *     summary: Get Self Repurchase Bonus status for current month (User only)
 *     description: |
 *       **User Access Only** — Returns the user's Self Repurchase Bonus (SRB) eligibility
 *       status for the current calendar month, and the last month's credit (if any).
 *
 *       **Eligibility Rule:**
 *       - User must accumulate **≥ 500 BV** from purchases made on **day 1–17** of the calendar month (IST).
 *       - Purchases are cumulative within the window (e.g., 300 BV on 3rd + 200 BV on 15th = eligible).
 *
 *       **Bonus Pool:**
 *       - Pool = 7% of the Company's total monthly BV.
 *       - Eligible users share the pool equally.
 *       - Deductions before credit: 5% admin charge + 2% TDS = **net 93%** credited to wallet.
 *
 *       **Credit Timing:**
 *       - Automatically credited at 23:55 IST on the last day of the month via cron job.
 *       - Admin can also trigger manually via `/api/v1/admin/self-repurchase-bonus/trigger-distribution`.
 *     tags: [User - Self Repurchase Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SRB status fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 statusCode: { type: integer, example: 200 }
 *                 message: { type: string, example: "Self Repurchase Bonus status fetched successfully" }
 *                 data:
 *                   $ref: '#/components/schemas/SRBUserStatus'
 *             example:
 *               success: true
 *               statusCode: 200
 *               message: "Self Repurchase Bonus status fetched successfully"
 *               data:
 *                 currentMonth:
 *                   year: 2026
 *                   month: 3
 *                   windowBV: 320
 *                   isEligible: false
 *                   bvNeededForEligibility: 180
 *                   eligibilityWindowDay: 17
 *                   windowClosed: false
 *                   windowClosesAt: "2026-03-17 23:59:59"
 *                 lastMonth:
 *                   year: 2026
 *                   month: 2
 *                   bonusReceived: true
 *                   grossAmount: 1000
 *                   netAmount: 930
 *                   adminCharge: 50
 *                   tdsDeducted: 20
 *                   creditedAt: "2026-03-01T00:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /api/v1/admin/self-repurchase-bonus/company-bv:
 *   get:
 *     summary: Get Company Total BV for a given month (Admin only)
 *     description: |
 *       **Admin Access Only** — Returns the aggregated company-wide Business Volume (BV)
 *       for any specified calendar month. This is the base figure used to calculate the 7% bonus pool.
 *
 *       **Note:** This includes ALL user repurchase BV for the entire month (not just the 1–10 window).
 *       Only non-first purchases contribute to this total.
 *     tags: [Admin - Self Repurchase Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-03"
 *         description: |
 *           Calendar month in **YYYY-MM** format. Defaults to the current month if not provided.
 *           Example: `2026-03` = March 2026
 *     responses:
 *       200:
 *         description: Company BV fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/SRBCompanyBV'
 *             example:
 *               success: true
 *               data:
 *                 year: 2026
 *                 month: 3
 *                 companyTotalBV: 100000
 *                 totalTransactions: 215
 *                 projectedPool: 7000
 *                 poolPercent: 7
 *       400:
 *         description: Invalid month format
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid month format. Use YYYY-MM (e.g. 2026-03)"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/v1/admin/self-repurchase-bonus/distribution:
 *   get:
 *     summary: Get distribution details for a given month (Admin only)
 *     description: |
 *       **Admin Access Only** — Returns the bonus pool document and the per-user credit list
 *       for the specified calendar month.
 *
 *       **Pool status values:**
 *       - `pending` — Month not yet closed; distribution has not run.
 *       - `distributed` — Pool distributed; all eligible users credited.
 *       - `held` — No eligible users found or zero company BV; pool frozen.
 *     tags: [Admin - Self Repurchase Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-02"
 *         description: |
 *           Calendar month in **YYYY-MM** format. Defaults to the current month if omitted.
 *     responses:
 *       200:
 *         description: Distribution details fetched (null if no record exists yet)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   nullable: true
 *                   type: object
 *                   properties:
 *                     pool:
 *                       $ref: '#/components/schemas/SRBBonusPool'
 *                     credits:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SRBWalletCredit'
 *             example:
 *               success: true
 *               data:
 *                 pool:
 *                   year: 2026
 *                   month: 2
 *                   companyTotalBV: 100000
 *                   poolAmount: 7000
 *                   eligibleUserCount: 7
 *                   grossSharePerUser: 1000
 *                   adminChargePercent: 5
 *                   tdsPercent: 2
 *                   netSharePerUser: 930
 *                   status: "distributed"
 *                   distributedAt: "2026-02-28T18:25:00.000Z"
 *                 credits:
 *                   - memberId: "SVS12345678"
 *                     grossAmount: 1000
 *                     netAmount: 930
 *                     adminCharge: 50
 *                     tdsDeducted: 20
 *                     creditedAt: "2026-02-28T18:25:00.000Z"
 *       400:
 *         description: Invalid month format
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/v1/admin/self-repurchase-bonus/trigger-distribution:
 *   post:
 *     summary: Manually trigger SRB month-end distribution (Admin only)
 *     description: |
 *       **Admin Access Only** — Manually triggers the Self Repurchase Bonus distribution
 *       for a specified month. Safe to call multiple times — **fully idempotent**.
 *
 *       **When to use:**
 *       - To test the distribution before month-end.
 *       - To re-run a month that shows `status: pending` after the cron should have fired.
 *       - Corrections after data fixes.
 *
 *       **Guard:** If the pool for the given month already has `status: distributed` or `status: held`,
 *       the call will return immediately without making any changes.
 *
 *       **Deduction breakdown applied automatically:**
 *       - Admin charge: 5% of each user's gross share
 *       - TDS: 2% of gross
 *       - Net credited to wallet: **93%** of gross share
 *     tags: [Admin - Self Repurchase Bonus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [year, month]
 *             properties:
 *               year:
 *                 type: integer
 *                 description: 4-digit calendar year
 *                 example: 2026
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 description: Calendar month (1 = January, 12 = December)
 *                 example: 3
 *           example:
 *             year: 2026
 *             month: 3
 *     responses:
 *       200:
 *         description: Distribution result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [distributed, held]
 *                       description: "'distributed' = credits issued. 'held' = no eligible users."
 *                     poolAmount: { type: number, example: 7000 }
 *                     creditsIssued: { type: integer, example: 7 }
 *             examples:
 *               distributed:
 *                 summary: Successful distribution
 *                 value:
 *                   success: true
 *                   message: "SRB distribution for 2026-03 — status: distributed"
 *                   data:
 *                     status: "distributed"
 *                     poolAmount: 7000
 *                     creditsIssued: 7
 *               held:
 *                 summary: No eligible users — pool held
 *                 value:
 *                   success: true
 *                   message: "SRB distribution for 2026-03 — status: held"
 *                   data:
 *                     status: "held"
 *                     poolAmount: 7000
 *                     creditsIssued: 0
 *               already_run:
 *                 summary: Already distributed (idempotent skip)
 *                 value:
 *                   success: true
 *                   message: "SRB distribution for 2026-02 — status: distributed"
 *                   data:
 *                     status: "distributed"
 *                     poolAmount: 6500
 *                     creditsIssued: 5
 *       400:
 *         description: Invalid year or month
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid year or month. month must be 1–12."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
