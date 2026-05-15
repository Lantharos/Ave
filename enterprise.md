Yeah, enterprise SSO is a different beast.

For your apps, “enterprise SSO” means:

> A company can connect their Google Workspace / Microsoft Entra / Okta / etc. so their employees log into your app with the company’s identity system.

The clean architecture for you is:

```txt
Customer's IdP
Google Workspace / Microsoft Entra / Okta / OneLogin
        ↓
      Ave
        ↓
Your apps: Lodger, Sty, Raday, etc.
```

So every app only integrates with **Ave**, and Ave handles the nasty enterprise provider stuff.

## What enterprises expect

For B2B apps, the usual checklist is:

```txt
1. SAML SSO
2. OIDC SSO
3. Verified company domains
4. Organization/team mapping
5. Role mapping
6. Just-in-time user creation
7. SCIM provisioning
8. Enforced SSO
9. Audit logs
10. Session controls
```

The absolute minimum to sell “enterprise SSO” is:

```txt
SAML + domain verification + enforced login for that org
```

OIDC is nicer technically, but SAML is still everywhere in enterprise land. It’s annoying XML soup, but companies expect it.

## The core model

You need an organization-level SSO config.

Example DB shape:

```sql
organizations
- id
- name
- slug
- verified_domain
- sso_required boolean

sso_connections
- id
- organization_id
- type -- "saml" | "oidc"
- provider -- "okta" | "google" | "entra" | "generic"
- entity_id
- sso_url
- certificate
- client_id
- client_secret_encrypted
- issuer
- status -- "draft" | "active" | "disabled"

users
- id
- ave_sub
- email

organization_memberships
- organization_id
- user_id
- role
- source -- "manual" | "sso" | "scim"
```

Enterprise SSO belongs to the **organization**, not the individual user.

## Login flow

The important trick: when someone types an email, you check whether that email’s domain belongs to an enterprise org.

```txt
kris@company.com
      ↓
company.com is verified by Acme Corp
      ↓
Acme has SSO required
      ↓
redirect user to Acme’s SSO provider
      ↓
provider authenticates user
      ↓
Ave receives SAML/OIDC response
      ↓
Ave creates/links user
      ↓
Ave issues normal Ave login to Lodger/Sty/etc.
```

From the app’s perspective, nothing special happened.

It just sees:

```txt
User signed in with Ave
```

Ave internally knows:

```txt
This user came from Acme's Okta connection
```

That’s the good architecture.

## SAML vs OIDC

Support both eventually.

### OIDC enterprise SSO

Cleaner. JSON. Modern. Less cursed.

You store:

```txt
issuer
client_id
client_secret
authorization_endpoint
token_endpoint
jwks_uri
scopes
```

Usually scopes:

```txt
openid email profile
```

### SAML enterprise SSO

Ugly but common.

You store:

```txt
entity_id
sso_url
x509 certificate
name_id format
attribute mappings
```

You generate for the customer:

```txt
ACS URL
Entity ID
Metadata URL
```

Example:

```txt
ACS URL:
https://aveid.net/sso/saml/acme/acs

Entity ID:
https://aveid.net/sso/saml/acme/metadata

Metadata URL:
https://aveid.net/sso/saml/acme/metadata.xml
```

The enterprise admin copies that into Okta / Entra / Google Workspace.

Then they give you their IdP metadata.

Very glamorous. Very 2007. Still required.

## What Ave should expose to your apps

Your apps should not care whether the user came from Google Workspace, Okta, Microsoft, or SAML.

Ave should issue a normal identity object like:

```json
{
  "sub": "ave_user_123",
  "email": "person@company.com",
  "email_verified": true,
  "org_id": "org_acme",
  "auth_method": "enterprise_sso",
  "sso_connection_id": "sso_okta_acme"
}
```

Then Lodger/Sty/Raday can do their normal thing.

## Domain verification

This is mandatory.

Otherwise someone could create an org called “Google” and force all `@google.com` people through their fake SSO. Comedy, but legally spicy.

Domain verification flow:

```txt
1. Admin adds company.com
2. You give them a DNS TXT record
3. They add it to DNS
4. You verify it
5. Domain becomes owned by that org
```

Example TXT:

```txt
ave-domain-verification=abc123securetoken
```

Only after that can they enforce SSO for:

```txt
@company.com
```

## Enforced SSO

This means:

> users with `@company.com` cannot use password/passkey/social login directly; they must use the company SSO.

Rules:

```txt
If domain belongs to org
AND org.sso_required = true
THEN redirect to org SSO
```

But keep a break-glass path.

You need:

```txt
owner/admin emergency login
backup recovery codes
support override maybe
```

Otherwise one bad SAML config locks out the whole company and now you’re debugging XML at 2 a.m. like a cursed priest.

## Just-in-time provisioning

When an employee logs in for the first time, you create the account automatically.

```txt
SAML/OIDC login succeeds
      ↓
email = ana@company.com
      ↓
org = Acme
      ↓
no existing user
      ↓
create Ave user
      ↓
create Acme membership
```

This is called **JIT provisioning**.

It’s enough for a first version.

## SCIM comes later

SCIM is how companies automatically create, update, disable, and remove users from your app.

Without SCIM:

```txt
Employee leaves company
Admin disables them in Okta
But your app may not know unless they try logging in again
```

With SCIM:

```txt
Admin disables employee in Okta
Okta calls your SCIM API
Your app immediately suspends/deprovisions them
```

Endpoints look like:

```txt
GET    /scim/v2/Users
POST   /scim/v2/Users
GET    /scim/v2/Users/:id
PATCH  /scim/v2/Users/:id
DELETE /scim/v2/Users/:id

GET    /scim/v2/Groups
POST   /scim/v2/Groups
PATCH  /scim/v2/Groups/:id
DELETE /scim/v2/Groups/:id
```

Do **not** build SCIM first unless you specifically need it. Build SSO first, then SCIM.

## Role mapping

Companies may want to map IdP groups to your app roles.

Example:

```txt
Okta group: Acme-Lodger-Admins
    → Lodger role: admin

Okta group: Acme-Lodger-Members
    → Lodger role: member

Okta group: Acme-Sty-Developers
    → Sty role: developer
```

In Ave, this could be generic:

```sql
sso_group_mappings
- organization_id
- sso_connection_id
- external_group
- app_id
- role
```

But don’t overdo this early. Start with:

```txt
First user who sets up SSO = org owner
Everyone else = member
```

Then add group mapping when customers ask.

## Admin setup UI

You need an enterprise settings page.

Something like:

```txt
Organization Settings
  → Security
    → Single Sign-On
      → Add SSO connection
        → Provider:
            Google Workspace
            Microsoft Entra ID
            Okta
            OneLogin
            Generic SAML
            Generic OIDC
```

For SAML setup, show:

```txt
ACS URL
Entity ID
Metadata URL
```

Then ask them to paste/upload:

```txt
IdP metadata XML
or
SSO URL + Entity ID + X.509 certificate
```

For OIDC setup, ask for:

```txt
Issuer URL
Client ID
Client Secret
```

Then add a button:

```txt
Test SSO connection
```

Do not let them enforce SSO until the test passes. That’s how you avoid self-inflicted enterprise lockout hell.

## The MVP for Ave enterprise SSO

Build this first:

```txt
1. Organizations
2. Domain verification by DNS TXT
3. SSO connection model
4. Generic SAML connection
5. Generic OIDC connection
6. Email-domain discovery during login
7. JIT user creation
8. Enforced SSO toggle
9. Admin setup UI
10. Audit logs for SSO events
```

Audit logs should include:

```txt
SSO connection created
SSO connection tested
SSO enabled
SSO enforced
User logged in via SSO
User failed SSO login
SSO certificate changed
Domain verified
```

## For your product ecosystem

The smartest setup is:

```txt
Ave handles:
- Enterprise SSO
- SAML/OIDC provider connections
- Domain verification
- SSO policies
- SCIM eventually
- Session risk/auth method metadata

Apps handle:
- Product-specific roles
- Workspaces/projects/repos/docs
- Billing
- Product permissions
```

So Lodger doesn’t implement Okta. Sty doesn’t implement Microsoft Entra. Raday doesn’t implement Google Workspace.

They all just trust Ave.

That’s the entire point of Ave being your identity spine.

## Pricing/product note

Enterprise SSO is usually a paid feature.

Not because the code is impossible, but because the support surface is disgusting:

```txt
"My Okta metadata changed"
"Our certificate expired"
"Why does Entra send this claim"
"Can you map this group"
"Why is NameID different"
"Our users are locked out"
```

So put it behind:

```txt
Pro / Business / Enterprise
```

or price it per org.

For your own products, you can make SSO free internally, but for external apps using Ave, enterprise SSO should probably be paid.

## The clean Ave pitch

Something like:

```txt
Add enterprise SSO to your app without implementing SAML, OIDC, SCIM, or domain verification yourself.

Ave brokers your customer’s identity provider and gives your app one simple OIDC login flow.
```

That’s actually strong.

Because the pain is real: nobody wants to implement SAML unless they have been spiritually defeated.

Yes. That’s exactly the smart move.

Make **Ave the enterprise identity broker**, then all your apps get enterprise SSO “for free” by only integrating with Ave.

The shape is:

```txt
Enterprise customer IdP
Okta / Microsoft Entra / Google Workspace / OneLogin / Generic SAML
        ↓
      Ave
        ↓
Lodger / Sty / Raday / Nook / Raffi / whatever
```

Your apps should **not** each implement SAML, SCIM, Okta, Entra, Google Workspace, etc. That would be cursed duplication. Ave should absorb that mess once.

## What Ave needs to support

Ave becomes two things at the same time:

```txt
1. Upstream IdP client/broker
   Ave talks to enterprise providers:
   - SAML
   - OIDC
   - SCIM

2. Downstream identity provider
   Your apps talk to Ave:
   - OIDC
   - maybe OAuth scopes
   - app sessions
```

So for example:

```txt
Acme Okta → SAML → Ave → OIDC → Lodger
```

or:

```txt
Acme Microsoft Entra → OIDC → Ave → OIDC → Sty
```

or eventually:

```txt
Acme Okta → SCIM → Ave → creates users/org memberships → all apps understand org access
```

That’s the correct abstraction.

## The key thing: apps must be org-aware

Ave can centralize enterprise login, but each app still needs to understand:

```txt
organizations
memberships
roles
permissions
billing/workspaces/projects
```

So Ave can say:

```json
{
  "sub": "ave_user_123",
  "email": "ana@acme.com",
  "org_id": "org_acme",
  "auth_method": "enterprise_sso",
  "sso_connection_id": "sso_acme_okta"
}
```

But Lodger still has to know:

```txt
Is this user allowed in this Lodger workspace?
Are they admin/member/viewer?
Can they access this audit log?
Can they create ledgers?
```

Sty still has to know:

```txt
Can they access this repo?
Can they push?
Can they manage runners?
Can they create tenants?
```

Ave handles **identity**.
Apps handle **product authorization**.

That separation matters.

## So yes, the enterprise support becomes reusable

Once Ave supports enterprise SSO, every app that uses Ave can say:

```txt
Supports enterprise SSO via Ave
```

Because technically they do.

But the product wording depends on how polished it is.

For your own apps, you can say:

```txt
Enterprise SSO
SAML/OIDC login via Ave
Domain-based SSO enforcement
Centralized organization identity
```

For external developers using Ave, the pitch is even better:

```txt
Add enterprise SSO to your app without implementing SAML or SCIM.
```

That is genuinely a good product.

## What SCIM should do in Ave

SCIM should probably live in Ave first, not in every app.

Enterprise IdP sends provisioning events to Ave:

```txt
Create user
Update user
Deactivate user
Create group
Update group
Remove user from group
```

Ave stores:

```txt
enterprise directory user
enterprise groups
organization membership
active/suspended status
```

Then apps consume that from Ave.

Example:

```txt
Okta disables ana@acme.com
        ↓
SCIM PATCH to Ave
        ↓
Ave marks user suspended in org_acme
        ↓
Lodger/Sty/Raday reject org access
```

That means apps don’t each need SCIM endpoints. Much cleaner.

## But there’s a catch

SCIM tells Ave about users and groups, but app-specific permissions still need a mapping layer.

Example:

```txt
Okta group: Acme Engineering
    → Sty role: developer

Okta group: Acme Finance
    → Lodger role: admin

Okta group: Acme Everyone
    → Raday role: member
```

That mapping can live in Ave as centralized policy, or each app can define how it interprets groups.

Best architecture:

```txt
Ave stores normalized enterprise groups.
Apps optionally define mappings from Ave groups → app roles.
```

So Ave doesn’t need to know every tiny Lodger permission, but it gives apps clean group data.

## Recommended architecture

I’d do this:

```txt
Ave:
- users
- organizations
- verified domains
- SSO connections
- SCIM directory sync
- enterprise groups
- org memberships
- auth/session policies
- audit logs
- normalized identity claims

Apps:
- product workspaces/projects/repos
- product-specific roles
- product-specific permissions
- billing surfaces
- app-level audit logs
```

Then Ave issues ID/access tokens to your apps with claims like:

```json
{
  "sub": "ave_user_123",
  "email": "ana@acme.com",
  "orgs": [
    {
      "id": "org_acme",
      "role": "member",
      "groups": ["engineering", "lodger-admins"]
    }
  ],
  "amr": ["sso"],
  "idp": "okta"
}
```

But don’t stuff too much into the token. Tokens can get huge. For detailed permissions, apps should call Ave or use their own DB.

## The MVP order

Do **not** start with SCIM. Start with SSO.

Build in this order:

```txt
1. Organizations in Ave
2. Domain verification
3. SSO connection per organization
4. Generic OIDC SSO
5. Generic SAML SSO
6. Email-domain discovery
7. JIT provisioning
8. Enforced SSO
9. Audit logs
10. Group/role mapping
11. SCIM provisioning
```

Why SCIM later?

Because SSO gets people logging in. SCIM is mostly for enterprise admin automation and deprovisioning. Important, yes. First thing? No.

## How login would work

User goes to Lodger:

```txt
lodger.app/login
```

Clicks “Continue with Ave” or enters email.

Lodger redirects to Ave:

```txt
lodger.app → aveid.net/oauth/authorize
```

Ave sees:

```txt
email = ana@acme.com
domain = acme.com
org = Acme
sso_required = true
provider = Okta SAML
```

Ave redirects to Okta:

```txt
aveid.net → acme.okta.com
```

Okta authenticates user, sends SAML response back to Ave.

Ave validates it, creates/links the user, then sends user back to Lodger through normal OIDC:

```txt
Okta → Ave → Lodger
```

Lodger never touches SAML. Beautiful. No XML goblin infestation in every app.

## What your apps need to implement

Each app only needs:

```txt
Sign in with Ave
Read Ave user/org claims
Create local session
Map Ave org/user to local workspace/member
Respect suspended/deprovisioned users
```

That’s it.

For example, in Lodger:

```txt
ave_org_id = org_acme
ave_user_sub = ave_user_123

Find Lodger organization where ave_org_id = org_acme
Find/create Lodger member where ave_sub = ave_user_123
Apply role
Create session
```

For Sty:

```txt
ave_org_id = org_acme
Find Sty tenant linked to org_acme
Apply repo/project permissions
```

## You also get one admin surface

Instead of every app having its own enterprise settings page, you can have:

```txt
Ave Admin
  → Organization
    → Domains
    → SSO
    → SCIM
    → Groups
    → Sessions
    → Audit logs
    → Connected apps
```

Then each app can show a small settings page that says:

```txt
Identity managed by Ave
SSO enabled for Acme
Manage in Ave →
```

That feels much more coherent.

## The big design decision

You need to decide whether Ave organizations are the source of truth for all Lantharos apps.

I’d say yes.

Meaning:

```txt
Ave org = canonical company/team identity
Lodger workspace = product resource linked to Ave org
Sty tenant = product resource linked to Ave org
Raday workspace = product resource linked to Ave org
```

So Acme is Acme everywhere.

That gets you:

```txt
one verified domain
one SSO setup
one SCIM setup
one user directory
many apps
```

Very Apple/Google/Microsoft-style platform behavior. Which is kind of the whole Lantharos thing anyway.

## Possible issue: indie apps like Nook/Raffi

For personal apps, you probably don’t need enterprise SSO.

But if they use Ave login anyway, they can technically support it.

Just don’t expose enterprise admin nonsense in consumer apps unless it makes sense. Nook with enterprise SSO is kind of funny in a “HR-mandated diary app” dystopia way.

For apps like these:

```txt
Lodger
Sty
Raday
Argent maybe
Ave itself
```

enterprise SSO makes sense.

For:

```txt
Nook
Raffi
Milo
```

maybe not, unless there’s a school/company/team version.

## The clean product split

Ave can have two layers:

```txt
Ave Core
- login
- passkeys
- OAuth/OIDC
- user identity

Ave Enterprise
- SAML
- enterprise OIDC
- SCIM
- domain verification
- enforced SSO
- directory sync
- group mapping
- audit logs
```

Your apps just consume Ave.

## Bottom line

Yes:

```txt
Add SAML/OIDC/SCIM to Ave once.
Make every app authenticate through Ave.
Make Ave the canonical org/user directory.
Let apps handle their own product permissions.
```

That gives every Lantharos app enterprise SSO without each app becoming a cursed little identity provider.

The phrase for this is basically:

```txt
Ave is an identity broker / enterprise SSO gateway.
```

And honestly, that is exactly the kind of thing Ave should be.
