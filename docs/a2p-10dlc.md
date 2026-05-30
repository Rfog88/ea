# Twilio A2P 10DLC registration — copy to paste

Pre-written brand + campaign answers for EA's number. The campaign is the **long pole**
on go-live (multi-day carrier approval), so register it before anything else. EA is a
single-user personal assistant: the only recurring recipient is Ryan (the business
owner), with occasional one-off texts to a named contact at Ryan's explicit request.

> Fill the bracketed values with real data before submitting. Keep volume estimates
> honest — inflated numbers slow vetting.

---

## Brand (business) registration

| Field | Value |
|---|---|
| Legal business name | `[exact name on the EIN — e.g. Fogle & Sons Electric LLC]` |
| Business type | `[Sole Proprietor / LLC / etc.]` |
| EIN / Tax ID | `[EIN]` (Sole-Prop registrations are a separate, limited path — use the LLC/EIN if available) |
| Business address | `[street, city, state, ZIP]` |
| Website | `[https://… or the best public URL]` |
| Industry / vertical | Professional services (electrical contracting) |
| Business contact | `[name, email, phone]` |
| Stock symbol / exchange | n/a (private) |

## Campaign registration

| Field | Value |
|---|---|
| Use case | **Low Volume Mixed** (single recipient, mixed notification + conversational) |
| Campaign description | Personal executive-assistant line for the business owner. Sends the owner a daily morning summary, reminders he asked for, and conversational replies to texts he sends the number. Occasionally relays a one-off message to a named contact at the owner's explicit instruction. Single primary recipient; not marketing; no bulk send. |
| Message flow / opt-in description | The recipient is the business owner, who provisioned and owns this number. Opt-in is established by the owner texting the number first (conversational opt-in) and by being the account holder. No third-party consumer enrollment; no purchased lists. |
| Opt-in keywords | n/a (owner-initiated conversational) |
| Opt-out | STOP / UNSUBSCRIBE / CANCEL / END / QUIT honored automatically (Twilio Advanced Opt-Out). |
| Opt-out message | `You're unsubscribed and will get no further messages from this number. Reply START to resume.` |
| Help keywords | HELP / INFO |
| Help message | `This is [Ryan]'s personal assistant line. Reply STOP to opt out. Msg&data rates may apply.` |
| Embedded links | No |
| Embedded phone numbers | No (the From number itself only) |
| Age-gated content | No |
| Direct lending / loan arrangement | No |
| Estimated volume | ~20 SMS/day, single recipient |

## Sample messages (provide 2–4 that match real traffic)

1. `Morning Ryan. 2 reminders: call the inspector; pick up the panel from supply. 1 meeting: 9:00 AM site walk at the Henderson job. Notes from yesterday: breaker sizing for the shop.`
2. `Reminder: follow up with the inspector at 3:00 PM today.`
3. `Got it — I'll text Amber that you're running 20 minutes late. Reply SEND to confirm, or tell me what to change.`
4. `Reply STOP to opt out. Msg&data rates may apply.`

## Notes for the reviewer / for us

- **Single end user.** This is not marketing or bulk messaging; the recurring recipient is
  the account owner. Frame it as a personal/internal notification + conversational line.
- **Consent language is real, not boilerplate.** Opt-out (STOP) and HELP responses are
  enforced — `send-sms` goes through Twilio's Messaging Service so Advanced Opt-Out applies.
- **Third-party sends are owner-directed and gated.** Any text to someone other than the
  owner requires the owner's explicit "send it" confirmation (`confirmed=true` in
  `skills/send-sms`), so there is no unsolicited outbound to consumers.
- After approval, attach the number to the **Messaging Service** tied to this campaign and
  point the messaging webhook at `https://ea.<your-domain>/sms` (see `DEPLOY.md` §5).
