# Slicing an epic into stories

Read this when a story will not split cleanly, or when a draft list of stories looks like a
project plan.

## The test

A good slice can be demoed, tested and shipped (or at least verified end to end) on its
own, and it removes a risk or delivers value even if the later slices are cut. If a story
only makes sense after three others land, it is not a slice, it is a step.

## Walking skeleton first

The first story is the thinnest path that touches every layer the epic needs, even if it is
crude: one hard-coded provider, one happy path, one user. It proves the architecture and
integration early, when changing course is cheap. Every later story thickens the skeleton.

## Splitting patterns

Try these in order and stop at the first that yields slices a user can tell apart.

| Pattern | Split along | Example: "Let enterprise admins sign in with their company identity provider" |
|---|---|---|
| **Workflow steps** | The steps a user takes, thinnest end-to-end first | Sign in with one provider -> admin configures the connection -> user is auto-created on first sign-in |
| **Business-rule variations** | Different rules for the same capability | Allow all domains -> restrict to verified domains -> enforce sign-in for specific roles only |
| **Data variations** | Types or sources of data | One identity provider type first, then the next |
| **Interface variations** | Platforms or entry points | Web first, then mobile or CLI |
| **Operations** | Create / read / update / delete | Set up a connection, then edit it, then remove it |
| **Simple, then complex** | Core case first, edge cases later | Standard flow first; expired sessions and misconfigured providers after |
| **Defer non-functional depth** | Make it work, then make it fast or polished | Correct first; bulk-import performance as its own slice |
| **Spike for an unknown** | A question that blocks sizing | "Can our session layer carry an external identity?" - time-boxed, ends in an answer, not code |

If none of these work, the story is probably still an epic. Treat it as one and split again.

## Anti-patterns

| Smell | Why it fails | Fix |
|---|---|---|
| **Layer slices**: "Create DB tables", "Build REST API", "Build UI" | Nothing works until all three land; nothing is demoable or cuttable | One story per user-visible capability that crosses the layers |
| **Component slices**: "Auth service", "Notification module" | Splits by team structure, not by value | Slice by what the user can now do |
| **Phases**: "Phase 1", "Phase 2" | Hides what each phase delivers and defers the risk | Name the capability each slice adds |
| **Testing or hardening at the end**: "Write tests", "Fix bugs" | Verification is saved for last, when it is most expensive and the first thing cut | Acceptance criteria and tests belong to every story |
| **Giant first story** | The riskiest piece is also the biggest, so risk is found late | Cut a walking skeleton, then add thickness |
| **Spike disguised as a story** | A vague estimate for an unknown | Make it a spike with a question and a time box |
| **Everything is "must have"** | No slice can be cut when the date slips | Mark which stories carry the outcome and which are enhancements |

## Sizing the epic itself

- Under about 3 stories: it is probably a single story. Say so.
- Over about 12 stories, or longer than a quarter: split the epic at the seam where the
  outcome could ship on its own (for example, "sign in" before "provisioning"), and say
  where that seam is. Do not just add more stories.
