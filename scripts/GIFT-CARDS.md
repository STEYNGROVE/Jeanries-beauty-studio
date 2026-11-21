# Gift-card enquiries and staff issuance

The public form only prepares a WhatsApp enquiry. Staff use the private ledger after confirming payment and agreeing terms with the customer. The site accepts no payments and issues no cards itself.

Create one private directory outside the repository, accessible only to the authorized staff member. Use the same ledger file for each command. Keep backups in protected storage.

- `python3 scripts/gift-card-ledger.py --ledger /private/path/gift-cards.json issue --cents AMOUNT_IN_CENTS --confirm-paid`
- `python3 scripts/gift-card-ledger.py --ledger /private/path/gift-cards.json check`
- `python3 scripts/gift-card-ledger.py --ledger /private/path/gift-cards.json redeem`
- `python3 scripts/gift-card-ledger.py --ledger /private/path/gift-cards.json void`

Deliver the generated code privately to the customer. The ledger stores its hash, value and transaction status. The code is shown only during issuance. Redemption is full-value and may be recorded once. The ledger records no recipient information.
