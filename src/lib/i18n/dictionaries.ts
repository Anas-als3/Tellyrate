/**
 * Every string the interface says, in both languages it says them in.
 *
 * `en` is the source of truth: `Dictionary` is derived from it, and `ar` is
 * typed as `Dictionary`, so a key that is missing, misspelled or invented on
 * the Arabic side is a compile error rather than a blank space on a page.
 *
 * Two rules keep it that way:
 *
 *  · No `as const` on the objects. Widening the values to `string` is what
 *    lets `ar` hold different text while holding the same shape.
 *  · Anything that interpolates or counts is a function, never a template
 *    assembled at the call site. English pluralises on one boundary; Arabic
 *    pluralises on five, and a sentence built from fragments cannot be
 *    reordered for a language that puts them in a different order.
 */

export type Locale = "en" | "ar";

export const LOCALES: Locale[] = ["en", "ar"];

export const DEFAULT_LOCALE: Locale = "en";

/** Read by the root layout and written by the language switcher. */
export const LOCALE_COOKIE = "tellyrate-locale";

export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

/** Each language named in its own script, the way a reader would look for it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/** For `og:locale`, which wants a full language tag rather than a bare code. */
export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  ar: "ar_SA",
};

/**
 * One formatter for both languages, on purpose.
 *
 * Saudi interfaces overwhelmingly use Western Arabic digits, and the site's
 * `font-variant-numeric: tabular-nums` alignment depends on them. Formatting
 * under `ar` would switch to Eastern Arabic numerals and break both.
 */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/**
 * Arabic counted nouns take five shapes, and picking the wrong one is the
 * fastest way to make an interface read as machine-written.
 *
 * CLDR's categories, with `many` also covering `other`: 11–99 and 100+ both
 * take the singular accusative tamyiz, so "11 مراجعة" and "100 مراجعة" are
 * built the same way. `{n}` in `few` and `many` is replaced with the count.
 */
function arCount(
  n: number,
  forms: { zero: string; one: string; two: string; few: string; many: string },
): string {
  if (n === 0) return forms.zero;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod = n % 100;
  const template = mod >= 3 && mod <= 10 ? forms.few : forms.many;
  return template.replace("{n}", formatNumber(n));
}

/** English needs only the singular/plural split, and no number in the zero case. */
function enCount(n: number, one: string, other: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : other}`;
}

/**
 * Enum values arrive from the database as plain strings, and the label maps
 * below are keyed on the exact members so a schema addition surfaces as a
 * compile error. This bridges the two without an `any` at every call site.
 */
export function lookup(
  map: Record<string, string>,
  key: string,
  fallback: string,
): string {
  return map[key] ?? fallback;
}

/* -------------------------------------------------------------------------- */
/* English — the source of truth                                              */
/* -------------------------------------------------------------------------- */

const en = {
  common: {
    siteName: "Tellyrate",
    skipToContent: "Skip to content",
    tagline: "Know where to train before you apply",

    search: "Search",
    close: "Close",
    dismiss: "Dismiss",
    cancel: "Cancel",
    back: "Back",
    next: "Next",
    previous: "Previous",
    home: "Home",
    loading: "Loading…",
    optional: "optional",
    required: "required",
    edited: "edited",
    separator: " · ",

    facilityCount: (n: number) => enCount(n, "facility", "facilities"),
    reviewCount: (n: number) => enCount(n, "review", "reviews"),
    cityCount: (n: number) => enCount(n, "city", "cities"),
    commentCount: (n: number) => enCount(n, "comment", "comments"),
    ratingCount: (n: number) => enCount(n, "rating", "ratings"),
    placeCount: (n: number) => enCount(n, "place", "places"),
    starCount: (n: number) => enCount(n, "star", "stars"),
    characterCount: (n: number) => enCount(n, "character", "characters"),
    yearCount: (n: number) => enCount(n, "year", "years"),

    noReviewsYet: "no reviews yet",
    outOfFive: (value: string) => `${value} out of 5`,
    outOfFiveFrom: (value: string, n: number) =>
      `${value} out of 5, from ${enCount(n, "review", "reviews")}`,
    pageOf: (page: number, total: number) =>
      `Page ${formatNumber(page)} of ${formatNumber(total)}`,
    pageNumber: (page: number) => `Page ${formatNumber(page)}`,
    pagination: "Pagination",

    /** The root layout's document metadata. */
    meta: {
      defaultTitle: "Tellyrate — know where to train before you apply",
      titleTemplate: "%s · Tellyrate",
      description:
        "Anonymous reviews of Saudi hospitals and clinics by the healthcare students who did their training year there — so you know which ones are worth applying to. No email, no real name, just a username.",
      ogTitle: "Tellyrate",
      ogDescription:
        "Where Saudi healthcare students actually trained, and which hospitals are worth applying to.",
    },

    language: {
      groupLabel: "Language",
      /** The button's accessible name, in the language of the page it sits on. */
      switchTo: "Switch to Arabic",
      /** What the button says: the other language, in its own script. */
      targetName: "العربية",
      currentName: "English",
      switching: "Switching language…",
    },

    /**
     * The theme toggle sits beside the language switcher and is the last piece
     * of chrome still speaking English. Keys are here so whoever translates
     * `theme-toggle.tsx` does not have to widen this contract.
     */
    theme: {
      /** Before hydration the toggle cannot know which theme resolved. */
      switchUnknown: "Switch colour theme",
      switchToLight: "Switch to light theme",
      switchToDark: "Switch to dark theme",
    },

    footer: {
      aboutNav: "About this site",
      anonymousHeading: "Anonymous by design",
      anonymousLine: "No email. No real name. Just a username.",
      anonymousNote:
        "An account exists only so that one person cannot review the same placement twice.",
      dataHeading: "Data",
      osmAttribution: "Facility data © OpenStreetMap contributors, ODbL",
      disclaimer:
        "Reviews are the opinions of the students who wrote them, not of the facilities described.",
    },
  },

  nav: {
    brandHome: "Tellyrate — home",
    sections: "Sections",
    facilities: "Facilities",
    cities: "Cities",
    guidelines: "Guidelines",
    about: "About",
    privacy: "Privacy",
    search: "Search",
    searchLabel: "Search facilities and cities",
    searchPlaceholder: "Search",
    menu: "Menu",
    account: "Account",
    logIn: "Log in",
    logOut: "Log out",
    signUp: "Create an account",
    writeReview: "Write a review",
    moderation: "Moderation queue",
  },

  home: {
    metaTitle: "Tellyrate — know where to train before you apply",
    metaDescription:
      "Anonymous reviews of the hospitals and clinics where healthcare students train. Search by name or city, read what supervision and hands-on time were actually like, and add your own placement.",

    eyebrow: "Anonymous reviews by healthcare students",
    heading: "Know where to train before you apply.",
    lede: "Students who already did their training year describe the supervision, the hands-on time and the way they were treated — so you can pick the hospitals worth applying to.",

    searchLabel: "Search facilities",
    searchPlaceholder: "Hospital, clinic, or city",
    searchButton: "Search",

    browseByCity: "Browse by city",

    /** The counter under the hero: facilities · cities · reviews. */
    stats: (facilities: number, cities: number, reviews: number) =>
      `${enCount(facilities, "facility", "facilities")} · ${enCount(cities, "city", "cities")} · ${
        reviews === 0
          ? "no reviews yet"
          : enCount(reviews, "review", "reviews")
      }`,

    mostReviewed: "Most reviewed",
    recentlyAdded: "Recently added",
    recentlyAddedNote: "waiting for a first review",
    highestRated: "Highest rated",
    highestRatedNote: (threshold: number) =>
      `${formatNumber(threshold)}+ reviews`,
    latestReviews: "Latest reviews",

    allFacilities: "All facilities",
    allFacilitiesByRating: "All facilities by rating",
    browseFacilities: "Browse facilities",

    noReviewsBody:
      "Nobody has written one yet. Every facility here is waiting for the first student who trained there to say what it was actually like.",
    noReviewsHint:
      "Find the place you trained, then leave a rating and a few sentences. Readers only ever see a username.",
    writeFirstReview: "Write the first review",

    privacyHeading: "Why this can be honest",
    promiseAccount:
      "Signing up asks for a username and a password. There is no email field, because there is no email.",
    promiseReviews:
      "Reviews carry no real name, no school and no exact dates — timing is blurred until a place has enough reviews to hide in.",
    promiseTracking:
      "No analytics, no third-party fonts, no trackers. Nothing on this page is loaded from anyone else’s server.",
    howThisWorks: "How this works",

    /** The card footer on a review preview, when the reviewer's field is unknown. */
    studentFallback: "Student",
  },

  facilities: {
    metaDescription:
      "Hospitals, clinics and health centres reviewed by the healthcare students who trained in them.",

    allFacilities: "All facilities",
    /** Builds "Hospitals in Riyadh matching “x”" without fixing the word order. */
    describe: (input: { noun: string; place?: string; q?: string }) => {
      const parts = [input.noun];
      if (input.place) parts.push(`in ${input.place}`);
      if (input.q) parts.push(`matching “${input.q}”`);
      return parts.join(" ");
    },
    titleWithPage: (heading: string, page: number) =>
      `${heading} — page ${formatNumber(page)}`,

    lede: "Every entry is a real place someone trained in. Ratings come only from students who were there.",
    searchLabel: "Search within facilities",
    searchFieldLabel: "Search facilities by name",
    searchPlaceholder: "Search by name — e.g. King Fahad",
    searchButton: "Search",

    resultsHeading: "Results",
    resultsStatusEmpty: "No facilities match these filters.",
    resultsStatus: (total: number, page: number, pageCount: number) =>
      `${formatNumber(total)} facilities match. Showing page ${formatNumber(page)} of ${formatNumber(pageCount)}.`,

    clearAll: "Clear all",
    clearFilters: "Clear filters",
    removeFilter: "— remove this filter",
    chipSearch: (q: string) => `Search: “${q}”`,
    chipCity: (name: string) => `City: ${name}`,
    chipCountry: (name: string) => `Country: ${name}`,
    chipKind: (name: string) => `Kind: ${name}`,
    chipMinRating: (min: number) => `Rated ${formatNumber(min)} and up`,

    emptyTitleQuery: (q: string) => `Nothing here matches “${q}”`,
    emptyTitle: "Nothing matches these filters",
    emptyBodyPrefix: "No facility on Tellyrate is called",
    emptyBodyInCity: (city: string) => ` in ${city}`,
    emptyBodySuffix:
      ". If you trained somewhere we do not list yet, adding it takes about a minute.",
    emptyBodyNoQuery:
      "Try widening one of the filters, or add the place you trained in.",
    addFacility: "Add this facility",

    filtersHeading: "Filters",
    showFilters: "Filters",
    anyCity: "Any city",
    anyCountry: "Any country",
    anyKind: "Any kind",
    anyRating: "Any rating",
    cityFamily: "City",
    countryFamily: "Country",
    kindFamily: "Kind",
    ratingFamily: "Minimum rating",
    ratingOption: (value: number) => `${formatNumber(value)} stars and up`,

    sortLabel: "Sort facilities",
    loadingStatus: "Loading facilities…",

    addPage: {
      metaTitle: "Add a place",
      metaDescription:
        "Can't find the hospital or clinic you trained at? Search first — it is probably already listed — and add it if it genuinely isn't.",
      eyebrow: "Missing a placement",
      heading: "Add a place",
      lede: "Most hospitals, clinics and health centres in the cities we cover are already listed. Search for yours first — if it is here, you can go straight to reviewing it.",
      signedOutPrefix: "Searching is open to everyone. Adding a place needs an account — ",
      signIn: "sign in",
      or: " or ",
      createOne: "create one",
      signedOutSuffix:
        ". It is a username and a password; we never ask for an email.",
      provenance:
        "Facility records come from OpenStreetMap and from students. If one is wrong, out of date or duplicated, say so from the facility’s own page and a moderator will look at it.",

      searchLabel: "What is it called?",
      searchPlaceholder: "King Fahad Medical City",
      cityFilterLabel: "City",
      everywhere: "Everywhere",
      typeMore:
        "Type at least two letters. Almost every hospital and clinic in the country is already here.",
      searching: "Searching…",
      searchFailed: "Search is not responding. Try again in a moment.",
      matches: (n: number, q: string) =>
        `${enCount(n, "place", "places")} match “${q}”.`,
      noMatches: (q: string) => `Nothing here matches “${q}”.`,
      reviewIt: "Review it",
      noneOfThese: "None of these — add it",
      searchFirst:
        "Search first. Adding a place that is already listed splits its reviews in two.",

      createHeading: "Add it to Tellyrate",
      createHint:
        "New places stay off the directory listings until they have their first review, so nothing appears that nobody has been to.",
      needAccount: "You need an account to add a place.",
      needAccountToSave:
        "You will need an account to save this — a username and a password, no email.",
      duplicateIn: (city: string) => `in ${city}, with`,
      thatsTheOne: "That’s the one — review it",
      lookFirst: "Look at it first",
      createdRedirect: "Taking you to its review page…",

      nameLabel: "Name — required",
      cityLabel: "City — required",
      chooseCity: "Choose a city",
      kindLabel: "Kind — required",
      chooseKind: "Choose one",
      nameLocalLabel: "Name in its own script — optional",
      nameLocalPlaceholder: "مدينة الملك فهد الطبية",
      nameLocalHint:
        "Helps the next person find it in whichever language they search.",
      addressLabel: "Street or district — optional",
      submit: "Add this place",
      submitting: "Adding…",
    },
  },

  facility: {
    breadcrumb: "Breadcrumb",
    notFoundTitle: "Facility not found",
    titleWithCity: (name: string, city: string) => `${name} — ${city}`,
    metaRated: (
      name: string,
      kind: string,
      place: string,
      rating: string,
      reviews: number,
    ) =>
      `${name} is a ${kind} in ${place}, rated ${rating} out of 5 across ${enCount(reviews, "anonymous review", "anonymous reviews")} by healthcare students who trained there — supervision, hands-on experience, workload and how students are treated.`,
    metaUnrated: (name: string, kind: string, place: string) =>
      `${name} is a ${kind} in ${place}. No student reviews yet. If you did a rotation, an internship or summer training here, write the first one — anonymously.`,

    pendingBadge: "Added by a user — not yet verified",
    writeReview: "Write a review",
    editYourReview: "Edit your review",
    writeFirstReview: "Write the first review",

    scoreHeading: "Student rating",
    notRatedYet: "Not rated yet",
    notRatedBody: (kind: string) =>
      `Nobody has reviewed this ${kind} yet. If you trained here, yours would be the first — and the only account anyone gets of what the placement is actually like.`,

    reviewsHeading: "Reviews",
    reviewsHeadingCount: (n: number) => enCount(n, "review", "reviews"),
    sortReviews: "Sort reviews",
    noReviewsYet: "No reviews yet.",
    noReviewsOnPage: "No reviews on this page.",
    writeTheFirstOne: "Write the first one.",
    backToFirstPage: "Back to the first page.",
    reviewPages: "Review pages",
    newerPage: "Newer page",
    olderPage: "Older page",

    whereHeading: "Where it is",
    address: "Address",
    coordinates: "Coordinates",
    phone: "Phone",
    website: "Website",
    openInOsm: "Open in OpenStreetMap",
    noMapNote:
      "No map is embedded here on purpose — loading tiles would tell another company which facility you were reading about.",

    flagHeading: "Something wrong here?",
    flagBody:
      "Wrong name, closed down, or the same place listed twice? Tell a moderator.",

    moreIn: (city: string) => `More in ${city}`,
    allFacilitiesIn: (city: string) => `All facilities in ${city}`,

    /** Rating distribution table. */
    distributionHeading: "Rating distribution",
    starsRow: (n: number) => enCount(n, "star", "stars"),

    loadingStatus: "Loading this facility…",
  },

  cities: {
    metaTitle: "Cities",
    metaDescription:
      "Every Saudi city with a hospital, clinic or health centre where students train.",

    heading: "Cities",
    lede: (cities: number, facilities: number) =>
      `${enCount(cities, "city", "cities")} with ${formatNumber(facilities)} places to train.`,

    emptyTitle: "No cities yet",
    emptyBody:
      "A city appears here as soon as it has its first facility. Add the place you trained in to start one off.",
    addFacility: "Add a facility",

    allFacilitiesIn: (n: number) =>
      `All ${enCount(n, "facility", "facilities")}`,
    cityLine: (facilities: number, reviews: number) =>
      reviews > 0
        ? `${enCount(facilities, "facility", "facilities")} · ${enCount(reviews, "review", "reviews")}`
        : enCount(facilities, "facility", "facilities"),

    notFoundTitle: "City not found",
    titleWithPage: (city: string, page: number) =>
      `${city} — page ${formatNumber(page)}`,
    metaDescriptionFor: (heading: string) =>
      `${heading} reviewed by the healthcare students who trained there.`,

    breadcrumb: "Cities",
    filterByKindAndRating: "Filter by kind and rating",
    sortLabelFor: (city: string) => `Sort facilities in ${city}`,
    resultsHeadingFor: (city: string) => `Facilities in ${city}`,
    resultsStatusEmpty: (city: string) =>
      `No facilities listed in ${city} yet.`,
    resultsStatus: (city: string, total: number, page: number, pageCount: number) =>
      `${formatNumber(total)} facilities in ${city}. Showing page ${formatNumber(page)} of ${formatNumber(pageCount)}.`,
    nothingListed: (city: string) => `Nothing listed in ${city} yet`,
    nothingListedBody:
      "If you trained at a hospital or clinic here, adding it takes about a minute and gives the next student somewhere to start.",
    browseOtherCities: "Browse other cities",
  },

  review: {
    authorDeleted: "deleted",
    edited: "edited",
    readTheRest: "Read the rest",
    outOfFive: "out of 5",

    ageThisWeek: "this week",
    ageThisMonth: "this month",
    agePastSixMonths: "in the past 6 months",
    agePastYear: "in the past year",
    ageOverYears: (n: number) =>
      `over ${enCount(n, "year", "years")} ago`,

    markHelpful: (noun: string) => `Mark this ${noun} helpful`,
    markUnhelpful: (noun: string) => `Mark this ${noun} unhelpful`,
    removeHelpful: "Remove your helpful mark",
    removeUnhelpful: "Remove your unhelpful mark",
    logInToMarkHelpful: (noun: string) => `Log in to mark this ${noun} helpful`,
    logInToMarkUnhelpful: (noun: string) =>
      `Log in to mark this ${noun} unhelpful`,
    cannotVoteOwn: (noun: string) => `You cannot vote on your own ${noun}.`,
    nounReview: "review",
    nounComment: "comment",

    report: "Report",
    reportThanks:
      "Thanks — a moderator will take a look. Nobody is told who reported this.",
    reportReasonLabel: "Why are you reporting this?",
    reportChooseReason: "Choose a reason",
    reportNoteLabel: "Anything else? (optional)",
    reportNoteHint:
      "Do not include anyone’s name — not yours, not a staff member’s.",
    reportSubmit: "Send report",
    reportSubmitting: "Sending…",

    comments: "Comments",
    commentsCount: (n: number) => enCount(n, "comment", "comments"),
    addComment: "Add a comment",
    addCommentPlaceholder:
      "Ask a question, or add what you saw on the same rotation.",
    reply: "Reply",
    replyTo: (username: string) => `Reply to @${username}`,
    replyPlaceholder: "Keep it about the placement.",
    postComment: "Post comment",
    postingComment: "Posting…",
    deleteComment: "Delete",
    deletingComment: "Deleting…",
  },

  reviewForm: {
    metaTitleFor: (name: string) => `Review ${name}`,
    metaTitle: "Write a review",
    metaDescriptionFor: (name: string) =>
      `Write an anonymous review of training at ${name}.`,

    draftRestored: (ago: string) =>
      `Draft restored — saved ${ago} on this device.`,
    agoMoment: "a moment ago",
    agoMinutes: (n: number) => `${enCount(n, "minute", "minutes")} ago`,
    agoHours: (n: number) => `${enCount(n, "hour", "hours")} ago`,
    agoDays: (n: number) => `${enCount(n, "day", "days")} ago`,
    startOver: "Start over",
    dismiss: "Dismiss",

    duplicateLink: (name: string) => `Edit your review of ${name}`,
    authHeading: "Almost there — you need an account to post.",
    authBody:
      "An account is a username and a password. No email, no name, nothing that can be traced back to you.",
    createAccount: "Create an account",
    signIn: "Sign in",
    goTo: "Go to",

    overallLegend: "Overall — required",
    overallQuestion: "Would you send a friend on this placement?",

    bodyLabel: "What was it like — required",
    bodyWarning:
      "Write about the place, not the people. Don’t name staff, patients, or yourself — that’s how anonymity breaks.",
    bodyPlaceholder:
      "What did a normal day look like? How much did you actually get to do? What would you want to know before you started?",
    bodyHelp: (min: number) =>
      `At least ${formatNumber(min)} characters. Specifics beat adjectives — one concrete morning tells a reader more than a paragraph of “great experience”.`,
    bodyCountRemaining: (written: number, remaining: number) =>
      `${enCount(written, "character", "characters")} — ${formatNumber(remaining)} more to go`,
    bodyCount: (written: number) =>
      enCount(written, "character", "characters"),

    scanHeading: "Before you post — this might identify someone.",
    scanItem: (label: string) => `Looks like ${label}`,
    scanFooter:
      "We guess from patterns and we guess wrong often — if this is fine, carry on. Nothing here stops you posting.",
    scanName: "a name",
    scanPhone: "a phone number",
    scanEmail: "an email address",
    scanHandle: "a social handle",
    scanDate: "an exact date",

    fieldLabel: "What were you training in — required",
    fieldPlaceholder: "Choose your field",
    fieldHint:
      "Kept broad on purpose — a narrower list would make a small cohort easy to pick apart.",

    roleLabel: "What were you there as — required",
    rolePlaceholder: "Choose your role",
    roleHint:
      "A reader weighs the same placement differently depending on whether it came from a first-week student or a second-year resident.",

    detailsSummary: "Add details — optional",
    titleLabel: "A one-line summary",
    titlePlaceholder: "Busy, well taught, no room to sit",

    axesLegend: "Rate the parts that matter",

    departmentLabel: "Department or unit",
    departmentPlaceholder: "Emergency, ICU, inpatient pharmacy…",
    departmentHint:
      "Helpful, but skip it on a quiet facility — a department plus a year can narrow you down.",

    yearLabel: "Year you were there",
    yearNotSaying: "Not saying",
    yearHint:
      "Year only. A month plus a small department can narrow a reviewer down to one person.",

    submit: "Post review",
    submitting: "Posting…",
    saveChanges: "Save changes",
    signedInAs: (username: string) =>
      `Posted anonymously as @${username}. Your account has no email or name attached.`,
    signedOutNote:
      "You can write first. We’ll ask you to sign in when you post, and your draft will be waiting when you come back.",
  },

  auth: {
    signInTitle: "Sign in",
    signInMetaDescription:
      "Sign in with the username and password you chose. No email is involved.",
    signInLede: "To post a review, comment, or vote. Reading needs nothing.",
    signInNoReset:
      "There is no email attached to your account, so there is nothing for us to send a reset link to. If you have lost both your password and your recovery code, the account cannot be reopened — by us or by anyone.",
    noAccountYet: "No account yet?",
    createOne: "Create one",
    createOneSuffix: " — it takes a username and a password.",

    signUpTitle: "Create an account",
    signUpMetaDescription:
      "An account here is a username and a password. No email, no real name, no school.",
    signUpLede: "Two fields, and nothing that could be traced back to you.",
    accountHoldsHeading: "What this account holds",
    weKeep: "What we keep",
    weNeverAsk: "What we never ask for",
    stored: [
      "The username you invent — the only name attached to anything you post.",
      "Your password, as a scrypt hash. Nobody here can read it back.",
      "The date you joined, and the reviews, comments and votes you make.",
    ],
    notStored: [
      "Email address. There is no field for one and no way to add one.",
      "Real name, school, programme, or student number.",
      "Exact rotation dates — reviews record a year at most.",
      "Analytics, trackers, third-party fonts or scripts of any kind.",
    ],
    recoveryWarning:
      "You will be shown a recovery code once, on the next screen. With no email on file it is the only way back in if you forget your password, so write it down before you go anywhere.",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign in",

    usernameLabel: "Username",
    usernameHint:
      "3–24 characters: letters, numbers, hyphens, underscores. This is the only name anyone will see, so pick one that is not yours.",
    passwordLabel: "Password",
    passwordHint:
      "At least 10 characters. No symbol-and-digit rules — a phrase you will remember is worth more than a puzzle you won’t.",
    submitSignIn: "Sign in",
    submitSignUp: "Create account",
    signingIn: "Signing in…",
    creatingAccount: "Creating account…",

    alreadySignedIn: (username: string) =>
      `You are already signed in as ${username}. An account is only a username and a password, so there is nothing to merge — to make a second one, sign out of this one first.`,
    yourAccount: "Your account",
    signOut: "Sign out",

    accountCreated: "Account created",
    signedInAs: (username: string) => `You are signed in as ${username}.`,
    recoverySaveWarning:
      "Save this. It is the only way back into your account if you forget your password — there is no email to reset with.",
    recoveryCodeLabel: "Recovery code",
    copyCode: "Copy code",
    copied: "Copied to your clipboard.",
    copyBlocked: "Copying was blocked — select the code above instead.",
    recoveryConfirm:
      "I have written this code down somewhere I can find it again.",
    continue: "Continue",
    tickTheBox: "Tick the box above once the code is safe.",

    layoutNote: "Reading never needs an account",
    layoutFooterPrefix:
      "An account here is a username and a password. No email, no real name, no school — see ",
    layoutFooterLink: "what we store",
  },

  account: {
    metaTitle: "Your account",
    securityMetaTitle: "Password and account",

    tabsLabel: "Account",
    tabAccount: "Account",
    tabSecurity: "Security",

    signOutHeading: "Sign out of this device?",
    signOutBodyPrefix: "Your other devices stay signed in. There is a ",
    signOutBodyLink: "sign out everywhere",
    signOutBodySuffix: " button if you need it.",
    signOut: "Sign out",

    signedInAs: "Signed in as",
    usernameNote: (username: string, joined: string) =>
      `This is the name that appears on everything you post, as @${username}. Joined ${joined}.`,

    contributions: "Your contributions",
    reviews: "Reviews",
    comments: "Comments",

    holdsLabel: "What this account holds",
    holdsHeading:
      "We hold no email, no name, and no school for this account.",
    holdsBody:
      "A username, a password hash, the date you joined, and what you have posted — that is the whole record. Nothing here can be used to send you anything, because there is nowhere to send it.",

    yourReviews: "Your reviews",
    mostRecentOf: (shown: number, total: number) =>
      `${formatNumber(shown)} most recent of ${formatNumber(total)}`,
    noReviewsPrefix: "You have not written one yet. ",
    noReviewsLink: "Find the place you trained",
    noReviewsSuffix: " and say what it was actually like.",

    actionsLabel: "Account actions",
    passwordAndAccount: "Password and account",

    securityHeading: "Password and account",
    securitySignedInAs: "Signed in as",
    recoveryUnused:
      "Your recovery code is still unused. It is the only way back into this account if you forget your password, so keep it somewhere you will find it again.",
    recoveryUsed:
      "This account has no unused recovery code left. If you forget your password there is no way back in — there is no email to reset with.",

    changePassword: "Change password",
    changePasswordBody:
      "Changing it signs out every other device. This one stays signed in.",
    currentPassword: "Current password",
    newPassword: "New password",
    newPasswordHint: "At least 10 characters.",
    confirmPassword: "New password again",
    changePasswordSubmit: "Change password",
    changingPassword: "Changing…",

    signOutEverywhere: "Sign out everywhere",
    signOutEverywhereBody:
      "Ends every session, including this one — the right move if you left yourself signed in on a ward computer. Your password does not change, so you can sign straight back in.",
    signingOut: "Signing out…",

    deleteAccount: "Delete account",
    deleteBody:
      "Your account, your password hash and your votes are deleted outright and cannot be restored.",
    deleteKeepsContent: (reviews: number, comments: number) =>
      `Your ${enCount(reviews, "review", "reviews")} and ${enCount(comments, "comment", "comments")} stay up, unattributed — they will read as @deleted. Other students are relying on them, and pulling them would quietly rewrite the ratings they helped build.`,
    deleteNothingPosted:
      "You have not posted anything, so nothing will be left behind. Had you posted, the text would stay up without your name on it.",
    yourPassword: "Your password",
    deleteConfirm:
      "I understand this cannot be undone, and that my reviews and comments stay up without a name on them.",
    deleteSubmit: "Delete my account",
    deleting: "Deleting…",

    layoutBrowse: "Browse facilities",
    layoutStore: "What we store",
    layoutGuidelines: "Posting guidelines",
  },

  search: {
    metaTitle: "Search",
    metaTitleFor: (q: string) => `Search: ${q}`,

    heading: "Search",
    lede: "Look for a hospital, clinic or health centre by name, or for a city to see everywhere students trained there.",
    formLabel: "Search facilities and cities",
    placeholder: "A hospital, a clinic, or a city",
    submit: "Search",

    browseAll: "Browse all facilities",
    browseByCity: "Browse by city",

    resultsFor: (q: string) => `Results for “${q}”`,
    statusNothing: (q: string) => `Nothing found for ${q}.`,
    status: (facilities: number, cities: number, q: string) =>
      `${enCount(facilities, "facility", "facilities")} and ${enCount(cities, "city", "cities")} match ${q}.`,

    emptyTitle: (q: string) => `Nothing found for “${q}”`,
    emptyBody:
      "Try a shorter name, or the city instead. If the place you trained in is genuinely missing, adding it takes about a minute.",
    addThisFacility: "Add this facility",

    citiesHeading: "Cities",
    facilitiesHeading: "Facilities",
    allResultsWithFilters: "All results, with filters",
    refineResults: "Refine these results",
  },

  moderate: {
    metaTitle: "Moderation queue",
    eyebrow: "Moderation",
    heading: "Open reports",
    nothingToDo: "Nothing reported. Nothing to do.",
    targetDeleted: "target deleted",
    statusLabel: (status: string) => `status: ${status}`,
    viewInContext: "View in context",
    removeContent: "Remove content",
    dismissReport: "Dismiss report",
    targetReview: "review",
    targetComment: "comment",
    targetFacility: "facility",
  },

  static: {
    about: {
      metaTitle: "About",
      metaDescription:
        "Tellyrate collects anonymous reviews of the hospitals and clinics where healthcare students do their clinical training, written by the students who trained there.",
      eyebrow: "About",
      heading: "Reviews of the places we train in",
      lede: "Tellyrate collects anonymous reviews of the hospitals, clinics and health centres where healthcare students do their clinical training — written by the students who did the rotation.",

      whyTitle: "Why it exists",
      whyP1:
        "Where you spend a rotation shapes what you take out of a healthcare degree more than almost anything else in it, and most students choose one on rumour. A senior tells you a department is worth asking for. A friend of a friend says another one is six weeks of standing in a corner. None of it is written down anywhere, so every cohort rediscovers the same things from scratch — and the departments that teach well get no credit for doing it.",
      whyP2:
        "This site is an attempt to write it down. One review is an opinion. Forty reviews of the same hospital, from students in different fields across several years, is evidence.",

      reviewTitle: "What a review contains",
      reviewP1:
        "Every review carries one overall rating and a few sentences of testimony. Six optional sub-ratings cover the things students actually compare placements on:",
      reviewAxes: [
        "Supervision and teaching — were you taught, or left to watch?",
        "Hands-on experience — did you get to do things yourself?",
        "How students are treated — as a colleague, or as an inconvenience?",
        "Workload and hours — reasonable, and predictable?",
        "Facilities and equipment — somewhere to sit, eat and change, and equipment that works.",
        "Safety and wellbeing — protective equipment, incident reporting, and what happened when someone raised a concern.",
      ],
      reviewP2:
        "A review also records the field you were training in and what you were there as — student, summer trainee, intern, resident, fellow or observer — which read together as “Pharmacy · Intern”. Naming the department is optional and free text, because departments are called different things everywhere.",
      reviewP3:
        "Timing is recorded as a year and nothing finer, and on a facility with fewer than five reviews even the year is widened to a five-year band. An exact month in a small department can point at exactly one person.",

      accountsTitle: "Reading is public. Writing needs an account.",
      accountsP1:
        "Nothing here is behind a login. Browsing facilities, reading reviews, following a sort link, sharing a page — none of it asks who you are, and none of it ever will.",
      accountsP2Prefix:
        "Posting a review, commenting or voting needs an account, because otherwise the ratings are worth nothing. An account is a username and a password. There is no email field, no phone number, no real name and no school anywhere in the database, so there is nothing to connect a review back to a rotation list. ",
      accountsP2Link: "The privacy page",
      accountsP2Suffix: " describes exactly what is stored, mechanism by mechanism.",

      rankingTitle: "How the ordering works",
      rankingHighestRated: "Highest rated",
      rankingP1:
        " does not sort by plain average, because a plain average lets one enthusiastic five-star review outrank a hospital with forty reviews averaging 4.6. Each rating is pulled toward the site-wide mean in proportion to how little evidence stands behind it — a Bayesian average with a confidence constant of eight reviews. A facility earns its position by accumulating agreement, not by being new.",
      rankingMostHelpful: "Most helpful",
      rankingP2:
        " sorts reviews by the lower bound of a 95% confidence interval on their like rate, rather than by likes minus dislikes. Subtracting would let a 600/400 review beat a 20/0 one; a raw ratio would put a single like at the top of the page.",
      rankingP3:
        "Neither number can be bought. Facilities cannot pay to rank higher, to add a review, or to have one taken down.",

      dataTitle: "Where the places come from",
      dataP1:
        "The directory itself is imported from OpenStreetMap: the facility names, kinds, coordinates and whatever address, phone number and website the map happens to hold. Records are keyed on their OpenStreetMap identity, so a re-import updates a place rather than duplicating it.",
      dataP2:
        "The data is uneven, and it shows. Some facilities are named only in Arabic, some only in transliteration, and an address is the exception rather than the rule. A name that reads oddly here almost certainly reads oddly in the map it came from.",
      dataP3:
        "If the place you trained at is missing, you can add it, and it joins the directory after a light duplicate check. If a facility’s details are wrong here they are probably wrong in OpenStreetMap too — correcting them there fixes them for everything else built on that map, not just for us.",
      dataLicencePrefix:
        "Facility data © OpenStreetMap contributors, available under the ",
      dataLicenceLink: "Open Database Licence",

      notTitle: "What this is not",
      notItems: [
        {
          strong: "Not a patient review site.",
          text: " Nothing here is about whether a hospital is a good place to be treated. The reviewers are describing a workplace they were taught in, which is a different question with different answers.",
        },
        {
          strong: "Not a complaints channel.",
          text: " Nobody at a facility is notified when it is reviewed. If something unsafe happened, it needs an incident report inside your institution as well — a review is not a substitute for one, and it will not reach anyone who can act.",
        },
        {
          strong: "Not unmoderated.",
          text: " Anonymous does not mean consequence-free. Naming staff or patients gets a review removed, and doing it repeatedly costs the account.",
        },
      ],
      notGuidelinesLink: "The guidelines",
      notGuidelinesSuffix: " spell out where the line is.",

      whoTitle: "Who runs it",
      whoP1:
        "Tellyrate is an independent project, not affiliated with any hospital, university, ministry or professional body. There is no advertising, nothing is sponsored, no listing is paid for, and no data is sold or shared with anyone — there is barely any to sell.",
      whoP2:
        "The way to raise something is the report control on the review, comment or facility in question. It goes to a moderation queue that a person reads.",

      relatedLabel: "Related pages",
      relatedGuidelines: "Review guidelines",
      relatedPrivacy: "Privacy",
      relatedBrowse: "Browse facilities",
    },

    guidelines: {
      metaTitle: "Review guidelines",
      metaDescription:
        "How to write a review that helps the next student: be concrete, be first-hand, and write about the place, never about the people.",
      eyebrow: "Guidelines",
      heading: "How to write a review worth reading",
      lede: "Two things keep this site useful: reviews specific enough to act on, and a hard line against turning them into attacks on individuals. Everything below follows from those two.",
      hardRule:
        "The rule that is never negotiable: write about the place, not the people. No staff names, no patient details.",

      peopleTitle: "Write about the place, not the people",
      peopleP1:
        "Never name a member of staff, and never describe one closely enough to be named. No names, no nicknames, no “the tall surgeon on the Tuesday list”, no “the new registrar in paediatrics”. A department can be criticised as sharply as you like. A department cannot lose its job, be harassed at work, or be threatened over something written here. A person can.",
      peopleP2:
        "There is nearly always an institutional way to say the same thing, and it is the more useful sentence anyway. Instead of “the consultant ignored us all afternoon”, write “students were regularly left on the ward with no supervising doctor after four”. The second version describes something the next student will also run into, and something the hospital could actually fix.",
      peopleP3:
        "This is the one rule applied without discussion: a review that identifies a person is removed, and doing it repeatedly costs the account.",

      patientsTitle: "Patients are not material",
      patientsP1:
        "No patient details of any kind — not names, not initials, not bed or room numbers, and not the extraordinary case you will remember for the rest of your career. A rare presentation, plus a month, plus a department, identifies a real person to everyone who was there, and they never agreed to appear in your review.",
      patientsP2:
        "If a story only works with the clinical detail left in, it does not belong on this site. Tell it to your tutor instead.",

      usefulTitle: "What makes a review useful",
      usefulItems: [
        {
          strong: "Be concrete.",
          text: " “Four students to one registrar, and we were taking histories on our own from the second day” tells a reader something. “Good hospital, nice staff” does not.",
        },
        {
          strong: "Write only what happened to you.",
          text: " First-hand, from a placement you actually did. Not what someone told you about the night shift in another department.",
        },
        {
          strong: "Cover the boring practicalities.",
          text: " They matter more than people admit: whether the ID badge exists on day one, whether the rota is published in advance, whether there is somewhere to change, eat, sit and pray, whether the on-call room is real.",
        },
        {
          strong: "Say what would have made it better.",
          text: " “Fine, but no teaching” is a lower bar than “the ward round starts at seven and nobody tells students that — ask to join it and you will be taught”.",
        },
        {
          strong: "Be fair about the bad days.",
          text: " One terrible week does not describe six months, and readers can tell the difference between a considered complaint and a bad mood.",
        },
        {
          strong: "Length is not quality.",
          text: " Four honest sentences beat three paragraphs of adjectives.",
        },
      ],

      ratingsTitle: "Rating the six axes",
      ratingsP1:
        "The overall rating is required. The six sub-ratings are optional, and you should leave blank any you cannot judge — a blank is more useful than a guess, because each average is computed only over the reviews that answered that axis.",
      ratingsP2:
        "Rate them independently. Plenty of placements are genuinely excellent at teaching and genuinely brutal on hours, and flattening that into a single number is precisely the problem this site exists to fix.",

      protectTitle: "Protecting yourself",
      protectItems: [
        "Choose a username with nothing of you in it: not your initials, not your graduation year, not the handle you use elsewhere.",
        "Leave out the details that pin a review to one person — exact dates, the size of your group, your specific project, the unusual thing only you did.",
        "If you were one of only one or two students in that department, write about patterns rather than incidents — and consider leaving the department box blank. It is optional, and a small named department plus a year narrows a review down fast.",
        "The site already widens your training year to a five-year band on facilities with fewer than five reviews. Do not undo that by putting the month in the text.",
      ],
      protectPrivacyLink: "The privacy page",
      protectPrivacySuffix:
        " explains exactly what the site stores, and is equally direct about the part it cannot protect: what you choose to write.",

      oneReviewTitle: "One review per placement",
      oneReviewP1:
        "The database allows one review per account per facility. If you go back, or your view of a place changes, edit the review you already have rather than posting a second one — stacking reviews would tilt the average in favour of whoever writes most. Edited reviews are marked as edited, so a later reader can see the text changed.",

      commentsTitle: "Comments and votes",
      commentsP1:
        "Comments are for adding context: a follow-up question, or “this changed in 2024, the rota is different now”. Replies go one level deep on purpose — a review thread is not a forum, and the people who come here are choosing a placement, not having an argument.",
      commentsP2:
        "A vote answers one question: was this review useful to someone choosing a placement? It does not mean you agree with it. Downvoting an accurate negative review because you are fond of the hospital is the fastest way to make the whole site worthless.",

      removedTitle: "What gets removed",
      removedItems: [
        "Anything identifying a member of staff or a patient.",
        "Harassment, abuse or threats.",
        "Spam, advertising and recruitment posts.",
        "Reviews of a placement the author did not do.",
        "Claims presented as fact that are simply untrue.",
        "Content that is not about clinical training.",
      ],
      removedP1:
        "Use the report control on any review, comment or facility. A report records what was reported, the reason, an optional note, and which account sent it — so that repeated bad-faith reporting can be dealt with too. Reports go to a queue a person reads.",

      facilitiesTitle: "If you work at a facility reviewed here",
      facilitiesP1:
        "If a review breaks the rules on this page — it names one of your colleagues, it describes a patient, it is about somewhere the author never trained — report it and a moderator will look at it.",
      facilitiesP2:
        "If it is simply unflattering and true, it stays. Nothing here can be bought, edited or withdrawn by the subject of it, which is the only reason any of it is worth reading.",

      relatedLabel: "Related pages",
      relatedAbout: "About Tellyrate",
      relatedPrivacy: "Privacy",
      relatedFind: "Find your placement",
    },

    privacy: {
      metaTitle: "Privacy",
      metaDescription:
        "What Tellyrate stores and what it does not: no email, no IP logs, no analytics, no third-party requests — and an honest account of where anonymity stops.",
      eyebrow: "Privacy",
      heading: "What we store, and what we don’t",
      lede: "This is a description of what the software does, not a statement of intent. Every claim below names a specific mechanism, so it can be checked rather than believed.",

      accountTitle: "An account is a username and a password",
      accountP1:
        "Signing up asks for a username and a password. That is the entire form. The row kept for you holds the username as you typed it, a case-folded copy of it so that two people cannot register names that differ only in capitalisation, a password hash, an optional hash of a single-use recovery code and the date that code was used if it ever was, a role, a flag saying whether the account is banned, and the date it was created.",
      accountP2:
        "There is no email column in the database. Not blank — absent. The same goes for a real name, a phone number, a date of birth, a school, a graduation year and a profile photo. Nothing asks for them, so nothing can leak them, and no future change of ownership can quietly start using them.",

      passwordsTitle: "Passwords",
      passwordsP1:
        "Passwords are hashed with scrypt from Node’s standard library — N = 32768, r = 8, p = 3, a 64-byte key and a fresh 16-byte random salt for every password. The cost parameters are written alongside each hash, so they can be raised later without locking anyone out. The password itself is never stored and cannot be recovered from the hash.",
      passwordsP2:
        "The cost of that is real and worth stating plainly: if you lose both your password and your recovery code, the account is unreachable. We hold nothing that could establish you as its owner, so there is no support route that could hand it back. That is the trade this design makes deliberately.",

      sessionsTitle: "Sessions and cookies",
      sessionsP1:
        "Signing in sets exactly one cookie, tellyrate_session. It is httpOnly so page scripts cannot read it, SameSite=Lax so another site cannot ride on it, marked Secure in production, and it expires after thirty days — slid forward once a session is more than half spent, so you are not logged out mid-visit.",
      sessionsP2:
        "The value in the cookie is 256 random bits. What the database stores is its SHA-256 digest, so a dump of the sessions table is a list of hashes that cannot be replayed as a login. Signing out deletes the row and the cookie; signing out everywhere deletes every session for the account, which is the remedy if you think your password has leaked.",
      sessionsP3:
        "The only other cookie is the language you picked, tellyrate-locale, holding en or ar. It is read on the server to decide which words a page is written in, and it is not sent anywhere else. There is no analytics cookie, no third-party cookie, and no consent banner, because there is nothing to consent to.",

      storageTitle: "Your browser’s local storage",
      storageP1:
        "Two things. tellyrate-theme holds light or dark once you have chosen one; a small inline script reads it before the first paint so a dark-mode visitor never gets a white flash. And while you are writing a review, a draft of it is saved under tellyrate:draft:v1 followed by that hospital\u2019s name \u2014 your text and your ratings \u2014 so that signing in partway through does not lose what you wrote. The draft is kept for fourteen days, or until you post, and you can clear it at any time by clearing site data for this domain. Both stay in your browser and are never sent to the server.",

      addressesTitle: "IP addresses are never stored",
      addressesP1:
        "Any site that lets strangers write needs a way to stop a flood, and the usual way is to keep a log of who did what from where — exactly what this site promises not to do.",
      addressesP2:
        "So an address is never written down. To count requests it is passed through HMAC-SHA256, keyed with a server secret plus today’s date in UTC, and only the first 24 characters of the digest are kept, as part of a key like review:a:<digest>. The row holds that key, a count, and the time the window resets. Nothing else: no timestamps of individual actions, no user agent, no path, no record of what was posted.",
      addressesP3:
        "Because the key includes the date, the same address produces a different digest tomorrow. Yesterday’s counters cannot be joined to today’s, so the table cannot be reassembled into a history of anyone’s activity — by us or by anyone who takes a copy of it. Expired rows are deleted outright.",
      addressesP4:
        "Two details, for completeness. IPv6 addresses are truncated to their /64 prefix before hashing, because phones rotate the rest of the address routinely and would otherwise get an unlimited supply of fresh counters. And when you are signed in, throttling counts against your account id instead — the address is not hashed at all.",

      thirdPartiesTitle: "No third parties, enforced by the browser",
      thirdPartiesP1:
        "There is no analytics, no tag manager, no advertising network, no A/B testing service, no session recorder, no error-reporting service, no embedded video, no social buttons and no map tiles. Fonts are served from this domain rather than a font CDN, which would otherwise hand your address to a third party on every page load.",
      thirdPartiesP2:
        "That is not only a policy — the browser enforces it. Every response carries a Content Security Policy of default-src 'self' with connect-src 'self' and frame-ancestors 'none': if a tracker were ever added to this site, your browser would refuse to contact it. The policy does permit inline scripts and styles, which the site needs in order to render a page before its JavaScript arrives \u2014 that allows code written into this site's own pages, never a request to anybody else's server. Responses also send Referrer-Policy: no-referrer, so following a link out of here does not tell the destination which facility page you were reading, and a Permissions-Policy that switches off camera, microphone, geolocation and interest-cohort advertising.",

      publicTitle: "What is public",
      publicP1:
        "Everything you post is public and indexable — that is the point of the site. Specifically: your username, your reviews with their ratings and text, your comments, the field you trained in, what you were there as, the department if you named one, the year (widened to a five-year band on facilities with fewer than five reviews), and the totals of likes and dislikes.",
      publicP2:
        "Who voted is not public. A facility page loads your own vote and no one else’s — the voter list is never sent to a browser.",

      limitsTitle: "Where honesty about anonymity stops",
      limitsP1:
        "A username with no email behind it protects you from being identified by this site. It does not protect you from being identified by what you write, and no software can.",
      limitsP2Prefix:
        "If you were the only pharmacy student in that department that term, or you describe an incident everyone there remembers, or you write the way you talk, a colleague reading it may well know who you are. Only you can judge how much detail is worth that risk. ",
      limitsP2Link: "The guidelines",
      limitsP2Suffix:
        " give concrete advice on writing something useful without pinning it to one person.",
      limitsP3:
        "Publishing is also less reversible than people expect. Deleting a review removes it from this site; it does not remove it from a search engine’s cache, someone’s screenshot, or a scraper’s copy taken an hour after you posted it.",

      hostingTitle: "The layer we don’t control",
      hostingP1:
        "The site runs on rented servers and reaches you across a network that belongs to other people. TLS terminates at the host, so the host can see connection metadata — an address, a timestamp, a requested path — exactly as it can for every site it serves, under its own policies rather than this one.",
      hostingP2:
        "What can be said is that the application never asks for those records, never stores them, and has nothing to join them to. Database backups contain the same rows described on this page and nothing more.",

      requestsTitle: "If someone demands the data",
      requestsP1:
        "If we were ever compelled to hand over what is held about an account, this is the complete list of what exists:",
      requestsItems: [
        "the username",
        "a password hash that cannot be reversed",
        "possibly a hash of a recovery code",
        "a role, a banned flag and a creation date",
        "the reviews, comments and votes already published for anyone to read",
      ],
      requestsP2:
        "There is no email address, no phone number, no address log and no browsing history, because none of it is ever collected. A demand cannot produce what was never written down.",

      changesTitle: "Changes to this page",
      changesP1:
        "This page describes the code, so it changes when the code does. If a future version of the site ever collected something new, this page would have to say so — and if it says nothing about a kind of data, that data is not collected.",

      relatedLabel: "Related pages",
      relatedAbout: "About Tellyrate",
      relatedGuidelines: "Review guidelines",
    },
  },

  errors: {
    errorEyebrow: "Error",
    errorTitle: "Something broke on our side",
    errorBody:
      "This page failed to render. Nothing you were reading or writing was sent anywhere, and trying again often works — most failures of this kind are a database connection that dropped for a second.",
    tryAgain: "Try again",
    browseFacilities: "Browse facilities",
    home: "Home",
    reference: (digest: string) => `Reference ${digest}`,

    notFoundEyebrow: "Error 404",
    notFoundTitle: "There is nothing at this address",
    notFoundBody:
      "The page may have been a facility that was merged into another record, or the link may simply be wrong. Searching for the place by name is usually faster than fixing the URL — hospital names arrive here from OpenStreetMap and are spelled in more ways than anyone would guess.",
    notFoundNavLabel: "Where to go instead",
    searchFacilities: "Search facilities",
    browseByCity: "Browse by city",

    facilityNotFoundEyebrow: "404 — not found",
    facilityNotFoundTitle: "There is no facility at this address",
    facilityNotFoundBody:
      "The link may be out of date, or two records for the same place may have been merged into one. Searching by name is the quickest way to find it again — hospital names are often listed in both English and Arabic.",
  },

  labels: {
    siteCountryName: "Saudi Arabia",

    facilityFallback: "Facility",
    studentFallback: "Student",
    traineeFallback: "Trainee",
    healthcareFallback: "Healthcare",
    notVisible: "Not visible",

    facilityKind: {
      HOSPITAL: "Hospital",
      CLINIC: "Clinic",
      HEALTH_CENTER: "Health centre",
      DENTAL_CLINIC: "Dental clinic",
      PHARMACY: "Pharmacy",
      LABORATORY: "Laboratory",
      REHAB_CENTER: "Rehabilitation",
      MENTAL_HEALTH: "Mental health",
      OTHER: "Other",
    },

    /** Used in headings: "Hospitals in Riyadh". */
    facilityKindPlural: {
      HOSPITAL: "Hospitals",
      CLINIC: "Clinics",
      HEALTH_CENTER: "Health centres",
      DENTAL_CLINIC: "Dental clinics",
      PHARMACY: "Pharmacies",
      LABORATORY: "Laboratories",
      REHAB_CENTER: "Rehabilitation centres",
      MENTAL_HEALTH: "Mental health facilities",
      OTHER: "Other facilities",
    },
    facilityKindPluralFallback: "Facilities",

    studentField: {
      MEDICINE: "Medicine",
      NURSING: "Nursing",
      PHARMACY: "Pharmacy",
      DENTISTRY: "Dentistry",
      LABORATORY: "Laboratory science",
      RADIOLOGY: "Radiology",
      PHYSIOTHERAPY: "Physiotherapy",
      RESPIRATORY: "Respiratory therapy",
      NUTRITION: "Nutrition",
      EMERGENCY_MEDICAL: "Emergency medical services",
      PUBLIC_HEALTH: "Public health",
      OTHER: "Other",
    },

    traineeRole: {
      STUDENT: "Student on rotation",
      SUMMER_TRAINEE: "Summer trainee",
      INTERN: "Intern",
      RESIDENT: "Resident",
      FELLOW: "Fellow",
      OBSERVER: "Observer",
      OTHER: "Other",
    },

    /** The short form used in the rotation stamp, where space is tight. */
    traineeRoleShort: {
      STUDENT: "Student",
      SUMMER_TRAINEE: "Summer trainee",
      INTERN: "Intern",
      RESIDENT: "Resident",
      FELLOW: "Fellow",
      OBSERVER: "Observer",
      OTHER: "Trainee",
    },

    ratingAxis: {
      supervision: {
        label: "Supervision & teaching",
        hint: "Were you taught, or left to watch?",
      },
      handsOn: {
        label: "Hands-on experience",
        hint: "Did you get to do things yourself?",
      },
      staffRespect: {
        label: "How students are treated",
        hint: "Were you treated as a colleague or an inconvenience?",
      },
      workload: {
        label: "Workload & hours",
        hint: "Were the hours reasonable and predictable?",
      },
      resources: {
        label: "Facilities & equipment",
        hint: "Somewhere to sit, eat, change, and working equipment?",
      },
      safety: {
        label: "Safety & wellbeing",
        hint: "PPE, incident reporting, and how concerns were handled.",
      },
    },

    reportReason: {
      SPAM: "Spam or advertising",
      HARASSMENT: "Harassment or abuse",
      PERSONAL_INFO: "Identifies a person",
      MISINFORMATION: "Factually untrue",
      OFF_TOPIC: "Not about clinical training",
      DUPLICATE: "Duplicate",
      OTHER: "Something else",
    },

    country: {
      SA: "Saudi Arabia",
    },

    sort: {
      most_reviewed: "Most reviewed",
      highest_rated: "Highest rated",
      newest: "Recently added",
      name: "Name (A–Z)",
    },

    reviewSort: {
      helpful: "Most helpful",
      newest: "Newest",
      oldest: "Oldest",
      highest: "Highest rated",
      lowest: "Lowest rated",
    },

    /** Read out with the star count on the rating input: "3 stars — Mixed". */
    ratingWords: ["Avoid", "Poor", "Mixed", "Good", "Excellent"],

    reviewStatus: {
      PENDING: "Awaiting moderation",
      HIDDEN: "Hidden by a moderator",
      REMOVED: "Removed by a moderator",
    },

    departmentSuggestions: [
      "Emergency",
      "Internal medicine",
      "General surgery",
      "Paediatrics",
      "Obstetrics & gynaecology",
      "Intensive care",
      "Anaesthesia",
      "Orthopaedics",
      "Psychiatry",
      "Radiology",
      "Cardiology",
      "Oncology",
      "Family medicine",
      "Inpatient pharmacy",
      "Outpatient pharmacy",
      "Clinical pharmacy",
      "Laboratory",
      "Microbiology",
      "Physiotherapy",
      "Dentistry",
      "Nursing ward",
      "Outpatient clinics",
    ],
  },
};

export type Dictionary = typeof en;

/* -------------------------------------------------------------------------- */
/* Arabic                                                                      */
/* -------------------------------------------------------------------------- */

const ar: Dictionary = {
  common: {
    siteName: "Tellyrate",
    skipToContent: "انتقل إلى المحتوى",
    tagline: "اعرف تجربة التدريب قبل ما تقدم",

    search: "بحث",
    close: "إغلاق",
    dismiss: "إخفاء",
    cancel: "إلغاء",
    back: "رجوع",
    next: "التالي",
    previous: "السابق",
    home: "الرئيسية",
    loading: "جارٍ التحميل…",
    optional: "اختياري",
    required: "مطلوب",
    edited: "تم التعديل",
    separator: " · ",

    facilityCount: (n: number) =>
      arCount(n, {
        zero: "0 منشأة",
        one: "منشأة واحدة",
        two: "منشأتان",
        few: "{n} منشآت",
        many: "{n} منشأة",
      }),
    reviewCount: (n: number) =>
      arCount(n, {
        zero: "0 مراجعة",
        one: "مراجعة واحدة",
        two: "مراجعتان",
        few: "{n} مراجعات",
        many: "{n} مراجعة",
      }),
    cityCount: (n: number) =>
      arCount(n, {
        zero: "0 مدينة",
        one: "مدينة واحدة",
        two: "مدينتان",
        few: "{n} مدن",
        many: "{n} مدينة",
      }),
    commentCount: (n: number) =>
      arCount(n, {
        zero: "0 تعليق",
        one: "تعليق واحد",
        two: "تعليقان",
        few: "{n} تعليقات",
        many: "{n} تعليقًا",
      }),
    ratingCount: (n: number) =>
      arCount(n, {
        zero: "0 تقييم",
        one: "تقييم واحد",
        two: "تقييمان",
        few: "{n} تقييمات",
        many: "{n} تقييمًا",
      }),
    placeCount: (n: number) =>
      arCount(n, {
        zero: "0 مكان",
        one: "مكان واحد",
        two: "مكانان",
        few: "{n} أماكن",
        many: "{n} مكانًا",
      }),
    starCount: (n: number) =>
      arCount(n, {
        zero: "0 نجمة",
        one: "نجمة واحدة",
        two: "نجمتان",
        few: "{n} نجوم",
        many: "{n} نجمة",
      }),
    characterCount: (n: number) =>
      arCount(n, {
        zero: "0 حرف",
        one: "حرف واحد",
        two: "حرفان",
        few: "{n} أحرف",
        many: "{n} حرفًا",
      }),
    yearCount: (n: number) =>
      arCount(n, {
        zero: "0 سنة",
        one: "سنة واحدة",
        two: "سنتان",
        few: "{n} سنوات",
        many: "{n} سنة",
      }),

    noReviewsYet: "لا توجد مراجعات حتى الآن",
    outOfFive: (value: string) => `${value} من 5`,
    outOfFiveFrom: (value: string, n: number) =>
      `${value} من 5، بناءً على ${arCount(n, {
        zero: "0 مراجعة",
        one: "مراجعة واحدة",
        two: "مراجعتين",
        few: "{n} مراجعات",
        many: "{n} مراجعة",
      })}`,
    pageOf: (page: number, total: number) =>
      `صفحة ${formatNumber(page)} من ${formatNumber(total)}`,
    pageNumber: (page: number) => `صفحة ${formatNumber(page)}`,
    pagination: "التنقل بين الصفحات",

    meta: {
      defaultTitle: "Tellyrate — اعرف تجربة التدريب قبل ما تقدم",
      titleTemplate: "%s · Tellyrate",
      description:
        "تجارب وتقييمات من طلاب التخصصات الصحية عن التدريب في مستشفيات ومنشآت السعودية. بدون بريد إلكتروني أو اسم حقيقي؛ فقط اسم مستخدم.",
      ogTitle: "Tellyrate",
      ogDescription:
        "تجارب طلاب التخصصات الصحية في مستشفيات ومنشآت السعودية قبل أن تختار مكان تدريبك.",
    },

    language: {
      groupLabel: "اللغة",
      switchTo: "عرض الموقع بالإنجليزية",
      targetName: "English",
      currentName: "العربية",
      switching: "جاري تغيير اللغة…",
    },

    theme: {
      switchUnknown: "تغيير مظهر الموقع",
      switchToLight: "استخدام المظهر الفاتح",
      switchToDark: "استخدام المظهر الداكن",
    },

    footer: {
      aboutNav: "عن Tellyrate",
      anonymousHeading: "خصوصيتك من البداية",
      anonymousLine: "بدون بريد إلكتروني أو اسم حقيقي. فقط اسم مستخدم.",
      anonymousNote:
        "نطلب حسابا فقط لمنع تكرار المراجعات من الشخص نفسه للمكان نفسه.",
      dataHeading: "مصدر البيانات",
      osmAttribution:
        "بيانات المنشآت © مساهمو OpenStreetMap، رخصة ODbL",
      disclaimer:
        "المراجعات تعبر عن تجارب الطلاب الذين كتبوها، وليست رأي المنشآت المذكورة.",
    },
  },

  nav: {
    brandHome: "Tellyrate — الصفحة الرئيسية",
    sections: "الأقسام",
    facilities: "المنشآت",
    cities: "المدن",
    guidelines: "إرشادات المراجعات",
    about: "عن الموقع",
    privacy: "الخصوصية",
    search: "بحث",
    searchLabel: "ابحث عن منشأة أو مدينة",
    searchPlaceholder: "اسم المنشأة أو المدينة",
    menu: "القائمة",
    account: "الحساب",
    logIn: "تسجيل الدخول",
    logOut: "تسجيل الخروج",
    signUp: "إنشاء حساب",
    writeReview: "شارك تجربتك",
    moderation: "قائمة البلاغات",
  },

  home: {
    metaTitle: "Tellyrate — اعرف تجربة التدريب قبل ما تقدم",
    metaDescription:
      "اقرأ تجارب طلاب التخصصات الصحية في مستشفيات ومنشآت السعودية، وقارن الإشراف وفرص التطبيق وطريقة التعامل قبل أن تختار مكان تدريبك.",

    eyebrow: "تجارب حقيقية من طلاب التخصصات الصحية",
    heading: "اعرف تجربة التدريب قبل ما تقدم.",
    lede: "اقرأ تجارب طلاب تدربوا قبلك: كيف كان الإشراف؟ هل كانت هناك فرص للتطبيق؟ وكيف كان تعامل الفريق؟",

    searchLabel: "ابحث عن منشأة",
    searchPlaceholder: "مستشفى أو عيادة أو مدينة",
    searchButton: "بحث",

    browseByCity: "تصفّح حسب المدينة",

    stats: (facilities: number, cities: number, reviews: number) =>
      `${arCount(facilities, {
        zero: "0 منشأة",
        one: "منشأة واحدة",
        two: "منشأتان",
        few: "{n} منشآت",
        many: "{n} منشأة",
      })} · ${arCount(cities, {
        zero: "0 مدينة",
        one: "مدينة واحدة",
        two: "مدينتان",
        few: "{n} مدن",
        many: "{n} مدينة",
      })} · ${
        reviews === 0
          ? "لا توجد مراجعات حتى الآن"
          : arCount(reviews, {
              zero: "0 مراجعة",
              one: "مراجعة واحدة",
              two: "مراجعتان",
              few: "{n} مراجعات",
              many: "{n} مراجعة",
            })
      }`,

    mostReviewed: "الأكثر مراجعةً",
    recentlyAdded: "أضيفت مؤخرا",
    recentlyAddedNote: "بانتظار أول مراجعة",
    highestRated: "الأعلى تقييما",
    highestRatedNote: (threshold: number) =>
      `${formatNumber(threshold)} مراجعات فأكثر`,
    latestReviews: "أحدث المراجعات",

    allFacilities: "كل المنشآت",
    allFacilitiesByRating: "كل المنشآت حسب التقييم",
    browseFacilities: "تصفّح المنشآت",

    noReviewsBody:
      "لا توجد مراجعات حتى الآن. إذا تدربت في إحدى هذه المنشآت، شارك تجربتك وكن أول من يكتب عنها.",
    noReviewsHint:
      "ابحث عن مكان تدريبك، وضع تقييما واكتب باختصار ما الذي أعجبك وما الذي يحتاج إلى تحسين. سيظهر اسم المستخدم فقط.",
    writeFirstReview: "شارك أول تجربة",

    privacyHeading: "اكتب براحتك، بدون معلوماتك الشخصية",
    promiseAccount:
      "لإنشاء حساب، تحتاج اسم مستخدم وكلمة مرور فقط. لا نطلب بريدك الإلكتروني أو اسمك الحقيقي.",
    promiseReviews:
      "لا يظهر في المراجعة اسمك الحقيقي أو جامعتك أو التاريخ الدقيق لتدريبك.",
    promiseTracking:
      "لا نستخدم أدوات تحليل أو تتبع، ولا نحمل خطوطا أو محتوى من مواقع خارجية.",
    howThisWorks: "اعرف كيف نحمي خصوصيتك",

    studentFallback: "طالب",
  },

  facilities: {
    metaDescription:
      "تقييمات وتجارب طلاب التخصصات الصحية في مستشفيات وعيادات ومراكز السعودية.",

    allFacilities: "كل المنشآت",
    describe: (input: { noun: string; place?: string; q?: string }) => {
      const parts = [input.noun];
      if (input.place) parts.push(`في ${input.place}`);
      if (input.q) parts.push(`مطابقة لبحث «${input.q}»`);
      return parts.join(" ");
    },
    titleWithPage: (heading: string, page: number) =>
      `${heading} — صفحة ${formatNumber(page)}`,

    lede: "جميع التقييمات كتبها طلاب تدربوا في هذه المنشآت فعلا.",
    searchLabel: "ابحث في المنشآت",
    searchFieldLabel: "ابحث عن منشأة بالاسم",
    searchPlaceholder: "ابحث بالاسم — مثل: الملك فهد",
    searchButton: "بحث",

    resultsHeading: "النتائج",
    resultsStatusEmpty: "لا توجد منشآت مطابقة لخيارات البحث.",
    resultsStatus: (total: number, page: number, pageCount: number) =>
      `وجدنا ${formatNumber(total)} منشأة. الصفحة ${formatNumber(page)} من ${formatNumber(pageCount)}.`,

    clearAll: "مسح الكل",
    clearFilters: "مسح خيارات التصفية",
    removeFilter: "— إزالة هذا الخيار",
    chipSearch: (q: string) => `بحث: «${q}»`,
    chipCity: (name: string) => `المدينة: ${name}`,
    chipCountry: (name: string) => `الدولة: ${name}`,
    chipKind: (name: string) => `النوع: ${name}`,
    chipMinRating: (min: number) =>
      `تقييم ${formatNumber(min)} فأعلى`,

    emptyTitleQuery: (q: string) => `لا شيء هنا يطابق «${q}»`,
    emptyTitle: "لا توجد نتائج مطابقة",
    emptyBodyPrefix: "لم نجد في Tellyrate منشأة باسم",
    emptyBodyInCity: (city: string) => ` في ${city}`,
    emptyBodySuffix:
      ". إذا كان مكان تدريبك غير موجود، يمكنك إضافته خلال دقيقة.",
    emptyBodyNoQuery:
      "جرب تغيير خيارات التصفية، أو أضف المكان الذي تدربت فيه.",
    addFacility: "إضافة منشأة",

    filtersHeading: "تصفية النتائج",
    showFilters: "تصفية",
    anyCity: "كل المدن",
    anyCountry: "كل الدول",
    anyKind: "كل الأنواع",
    anyRating: "كل التقييمات",
    cityFamily: "المدينة",
    countryFamily: "الدولة",
    kindFamily: "النوع",
    ratingFamily: "الحد الأدنى للتقييم",
    ratingOption: (value: number) =>
      `${formatNumber(value)} نجوم فأعلى`,

    sortLabel: "ترتيب النتائج",
    loadingStatus: "جاري تحميل المنشآت…",

    addPage: {
      metaTitle: "أضف مكانًا",
      metaDescription:
        "إذا لم تجد المستشفى أو العيادة التي تدربت فيها، ابحث عنها أولا ثم أضفها إذا لم تكن موجودة.",
      eyebrow: "لم تجد مكان تدريبك؟",
      heading: "أضف منشأة",
      lede: "معظم المنشآت موجودة مسبقا. ابحث عن مكان تدريبك أولا، وإذا وجدته يمكنك الانتقال مباشرة إلى كتابة مراجعتك.",
      signedOutPrefix: "البحث متاح للجميع، لكن إضافة منشأة تحتاج إلى حساب. ",
      signIn: "سجّل الدخول",
      or: " أو ",
      createOne: "أنشئ حسابًا",
      signedOutSuffix:
        ". نطلب اسم مستخدم وكلمة مرور فقط، بدون بريد إلكتروني.",
      provenance:
        "بيانات المنشآت مأخوذة من OpenStreetMap ومن إضافات المستخدمين. إذا وجدت اسما خاطئا أو منشأة مغلقة أو مكررة، أرسل بلاغا من صفحة المنشأة.",

      searchLabel: "ما اسم المكان؟",
      searchPlaceholder: "مدينة الملك فهد الطبية",
      cityFilterLabel: "المدينة",
      everywhere: "كل المدن",
      typeMore:
        "اكتب حرفين على الأقل. معظم مستشفيات وعيادات المملكة موجودة بالفعل.",
      searching: "جاري البحث…",
      searchFailed: "تعذر البحث الآن. حاول مرة أخرى بعد قليل.",
      matches: (n: number, q: string) =>
        `${arCount(n, {
          zero: "0 مكان",
          one: "مكان واحد",
          two: "مكانان",
          few: "{n} أماكن",
          many: "{n} مكانًا",
        })} مطابق لبحث «${q}».`,
      noMatches: (q: string) => `لم نجد نتيجة مطابقة لبحث «${q}».`,
      reviewIt: "شارك تجربتك",
      noneOfThese: "ليست ضمن النتائج — أضفها",
      searchFirst:
        "ابحث أولا حتى لا تضيف منشأة موجودة مسبقا وتتوزع مراجعاتها على صفحتين.",

      createHeading: "أضفه إلى Tellyrate",
      createHint:
        "لن تظهر المنشأة الجديدة في الدليل إلا بعد نشر أول مراجعة عنها.",
      needAccount: "تحتاج إلى حساب لإضافة منشأة.",
      needAccountToSave:
        "تحتاج إلى حساب لحفظها. اسم مستخدم وكلمة مرور فقط، بدون بريد إلكتروني.",
      duplicateIn: (city: string) => `في ${city} ولديها`,
      thatsTheOne: "هذه هي — شارك تجربتك",
      lookFirst: "عرض المنشأة",
      createdRedirect: "جاري فتح صفحة المراجعة…",

      nameLabel: "الاسم — مطلوب",
      cityLabel: "المدينة — مطلوبة",
      chooseCity: "اختر مدينة",
      kindLabel: "النوع — مطلوب",
      chooseKind: "اختر النوع",
      nameLocalLabel: "الاسم بالعربية — اختياري",
      nameLocalPlaceholder: "مدينة الملك فهد الطبية",
      nameLocalHint:
        "يساعد الآخرين على العثور عليها سواء بحثوا بالعربية أو الإنجليزية.",
      addressLabel: "الشارع أو الحي — اختياري",
      submit: "أضف هذا المكان",
      submitting: "جاري الإضافة…",
    },
  },

  facility: {
    breadcrumb: "مسار التصفّح",
    notFoundTitle: "المنشأة غير موجودة",
    titleWithCity: (name: string, city: string) => `${name} — ${city}`,
    metaRated: (
      name: string,
      kind: string,
      place: string,
      rating: string,
      reviews: number,
    ) =>
      `${name}، ${kind} في ${place}. تقييم الطلاب ${rating} من 5، بناء على ${arCount(reviews, {
        zero: "0 مراجعة",
        one: "مراجعة واحدة",
        two: "مراجعتين",
        few: "{n} مراجعات",
        many: "{n} مراجعة",
      })}. اقرأ تجاربهم عن الإشراف والتطبيق العملي وحجم العمل وتعامل الفريق.`,
    metaUnrated: (name: string, kind: string, place: string) =>
      `${name}، ${kind} في ${place}. لا توجد مراجعات عن التدريب هنا حتى الآن. إذا تدربت في هذه المنشأة، شارك أول تجربة عنها بدون ذكر معلوماتك الشخصية.`,

    pendingBadge: "أضافها أحد المستخدمين ولم نتحقق منها بعد",
    writeReview: "شارك تجربتك",
    editYourReview: "عدّل مراجعتك",
    writeFirstReview: "شارك أول تجربة",

    scoreHeading: "تقييم الطلبة",
    notRatedYet: "لا يوجد تقييم حتى الآن",
    notRatedBody: () =>
      "لم يشارك أحد تجربة التدريب في هذه المنشأة حتى الآن. إذا تدربت فيها، شارك تجربتك وكن أول من يقيّمها.",

    reviewsHeading: "المراجعات",
    reviewsHeadingCount: (n: number) =>
      arCount(n, {
        zero: "لا مراجعات",
        one: "مراجعة واحدة",
        two: "مراجعتان",
        few: "{n} مراجعات",
        many: "{n} مراجعة",
      }),
    sortReviews: "ترتيب المراجعات",
    noReviewsYet: "لا توجد مراجعات حتى الآن.",
    noReviewsOnPage: "لا مراجعات في هذه الصفحة.",
    writeTheFirstOne: "شارك أول تجربة.",
    backToFirstPage: "العودة إلى الصفحة الأولى.",
    reviewPages: "صفحات المراجعات",
    newerPage: "صفحة أحدث",
    olderPage: "صفحة أقدم",

    whereHeading: "الموقع",
    address: "العنوان",
    coordinates: "الإحداثيات",
    phone: "الهاتف",
    website: "الموقع الإلكتروني",
    openInOsm: "افتحه في OpenStreetMap",
    noMapNote:
      "لا نعرض خريطة داخل الصفحة حفاظا على خصوصيتك؛ فتح الخريطة الخارجية قد يكشف للجهة المزودة أي منشأة تشاهدها.",

    flagHeading: "وجدت معلومة غير صحيحة؟",
    flagBody:
      "إذا كان الاسم خاطئا، أو أغلقت المنشأة، أو كانت مكررة، أرسل لنا بلاغا.",

    moreIn: (city: string) => `المزيد في ${city}`,
    allFacilitiesIn: (city: string) => `كل المنشآت في ${city}`,

    distributionHeading: "توزيع التقييمات",
    starsRow: (n: number) =>
      arCount(n, {
        zero: "لا نجوم",
        one: "نجمة واحدة",
        two: "نجمتان",
        few: "{n} نجوم",
        many: "{n} نجمة",
      }),

    loadingStatus: "جاري تحميل بيانات المنشأة…",
  },

  cities: {
    metaTitle: "المدن",
    metaDescription:
      "مدن السعودية التي تضم مستشفيات ومنشآت صحية يتدرب فيها الطلاب.",

    heading: "المدن",
    lede: (cities: number, facilities: number) =>
      `${arCount(cities, {
        zero: "لا مدن",
        one: "مدينة واحدة",
        two: "مدينتان",
        few: "{n} مدن",
        many: "{n} مدينة",
      })} تضم ${formatNumber(facilities)} مكانا للتدريب.`,

    emptyTitle: "لا مدن بعد",
    emptyBody:
      "تظهر المدينة هنا بعد إضافة أول منشأة فيها. أضف مكان تدريبك لتكون البداية.",
    addFacility: "أضف منشأة",

    allFacilitiesIn: (n: number) =>
      `كل ${arCount(n, {
        zero: "المنشآت",
        one: "المنشآت (منشأة واحدة)",
        two: "المنشأتين",
        few: "المنشآت الـ{n}",
        many: "المنشآت الـ{n}",
      })}`,
    cityLine: (facilities: number, reviews: number) => {
      const f = arCount(facilities, {
        zero: "0 منشأة",
        one: "منشأة واحدة",
        two: "منشأتان",
        few: "{n} منشآت",
        many: "{n} منشأة",
      });
      if (reviews <= 0) return f;
      const r = arCount(reviews, {
        zero: "0 مراجعة",
        one: "مراجعة واحدة",
        two: "مراجعتان",
        few: "{n} مراجعات",
        many: "{n} مراجعة",
      });
      return `${f} · ${r}`;
    },

    notFoundTitle: "المدينة غير موجودة",
    titleWithPage: (city: string, page: number) =>
      `${city} — صفحة ${formatNumber(page)}`,
    metaDescriptionFor: (heading: string) =>
      `${heading} يراجعها طلبة التخصصات الصحية الذين تدرّبوا فيها.`,

    breadcrumb: "المدن",
    filterByKindAndRating: "تصفية حسب النوع والتقييم",
    sortLabelFor: (city: string) => `ترتيب المنشآت في ${city}`,
    resultsHeadingFor: (city: string) => `المنشآت في ${city}`,
    resultsStatusEmpty: (city: string) =>
      `لا توجد منشآت في ${city} حتى الآن.`,
    resultsStatus: (city: string, total: number, page: number, pageCount: number) =>
      `${formatNumber(total)} منشأة في ${city}. الصفحة ${formatNumber(page)} من ${formatNumber(pageCount)}.`,
    nothingListed: (city: string) => `لا توجد منشآت في ${city} حتى الآن`,
    nothingListedBody:
      "إذا تدربت في مستشفى أو عيادة هنا، أضفها وشارك تجربتك ليستفيد الطلاب بعدك.",
    browseOtherCities: "تصفّح مدنًا أخرى",
  },

  review: {
    authorDeleted: "محذوف",
    edited: "تم التعديل",
    readTheRest: "قراءة المزيد",
    outOfFive: "من 5",

    ageThisWeek: "هذا الأسبوع",
    ageThisMonth: "هذا الشهر",
    agePastSixMonths: "خلال آخر 6 أشهر",
    agePastYear: "خلال آخر سنة",
    ageOverYears: (n: number) =>
      `قبل أكثر من ${arCount(n, {
        zero: "سنة",
        one: "سنة",
        two: "سنتين",
        few: "{n} سنوات",
        many: "{n} سنة",
      })}`,

    markHelpful: (noun: string) =>
      `صوّت بأن ${noun} ${noun === "التعليق" ? "مفيد" : "مفيدة"}`,
    markUnhelpful: (noun: string) =>
      `صوّت بأن ${noun} ${noun === "التعليق" ? "غير مفيد" : "غير مفيدة"}`,
    removeHelpful: "إلغاء تصويت «مفيدة»",
    removeUnhelpful: "إلغاء تصويت «غير مفيدة»",
    logInToMarkHelpful: (noun: string) =>
      `سجل الدخول لتصوت بأن ${noun} ${noun === "التعليق" ? "مفيد" : "مفيدة"}`,
    logInToMarkUnhelpful: (noun: string) =>
      `سجل الدخول لتصوت بأن ${noun} ${noun === "التعليق" ? "غير مفيد" : "غير مفيدة"}`,
    cannotVoteOwn: (noun: string) =>
      `لا يمكنك التصويت على ${noun} ${noun === "التعليق" ? "الذي كتبته" : "التي كتبتها"}.`,
    nounReview: "المراجعة",
    nounComment: "التعليق",

    report: "إبلاغ",
    reportThanks:
      "شكرا، وصل البلاغ وسيراجعه مشرف المحتوى. لن يظهر اسم من أرسل البلاغ.",
    reportReasonLabel: "ما سبب البلاغ؟",
    reportChooseReason: "اختر سببًا",
    reportNoteLabel: "ملاحظة إضافية (اختياري)",
    reportNoteHint:
      "لا تذكر اسمك أو اسم أي شخص من العاملين.",
    reportSubmit: "أرسل البلاغ",
    reportSubmitting: "جاري الإرسال…",

    comments: "التعليقات",
    commentsCount: (n: number) =>
      arCount(n, {
        zero: "لا تعليقات",
        one: "تعليق واحد",
        two: "تعليقان",
        few: "{n} تعليقات",
        many: "{n} تعليقًا",
      }),
    addComment: "أضف تعليقًا",
    addCommentPlaceholder:
      "اسأل عن التجربة، أو أضف معلومة من تدريبك في المكان نفسه.",
    reply: "رد",
    replyTo: (username: string) => `الرد على ‎@${username}`,
    replyPlaceholder: "اكتب عن تجربة التدريب في المكان.",
    postComment: "انشر التعليق",
    postingComment: "جاري النشر…",
    deleteComment: "حذف",
    deletingComment: "جاري الحذف…",
  },

  reviewForm: {
    metaTitleFor: (name: string) => `شارك تجربتك في ${name}`,
    metaTitle: "شارك تجربتك",
    metaDescriptionFor: (name: string) =>
      `شارك تجربتك في التدريب في ${name} بدون ذكر معلوماتك الشخصية.`,

    draftRestored: (ago: string) =>
      `استعدنا مسودتك المحفوظة ${ago} على هذا الجهاز.`,
    agoMoment: "قبل لحظات",
    agoMinutes: (n: number) =>
      `قبل ${arCount(n, {
        zero: "دقيقة",
        one: "دقيقة",
        two: "دقيقتين",
        few: "{n} دقائق",
        many: "{n} دقيقة",
      })}`,
    agoHours: (n: number) =>
      `قبل ${arCount(n, {
        zero: "ساعة",
        one: "ساعة",
        two: "ساعتين",
        few: "{n} ساعات",
        many: "{n} ساعة",
      })}`,
    agoDays: (n: number) =>
      `قبل ${arCount(n, {
        zero: "يوم",
        one: "يوم",
        two: "يومين",
        few: "{n} أيام",
        many: "{n} يومًا",
      })}`,
    startOver: "ابدأ من جديد",
    dismiss: "تجاهل",

    duplicateLink: (name: string) => `تعديل مراجعتك عن ${name}`,
    authHeading: "بقيت خطوة واحدة: سجل الدخول لنشر مراجعتك.",
    authBody:
      "الحساب يحتاج اسم مستخدم وكلمة مرور فقط. لا نطلب بريدا إلكترونيا أو اسما حقيقيا.",
    createAccount: "أنشئ حسابًا",
    signIn: "سجّل الدخول",
    goTo: "انتقل إلى",

    overallLegend: "التقييم العام — مطلوب",
    overallQuestion: "هل تنصح زميلا بالتدريب في هذا المكان؟",

    bodyLabel: "كيف كانت تجربتك؟ — مطلوب",
    bodyWarning:
      "اكتب عن المكان والتدريب، وليس عن أشخاص بأسمائهم. لا تذكر اسمك أو أسماء العاملين أو أي معلومات عن المرضى.",
    bodyPlaceholder:
      "كيف كان يومك المعتاد؟ هل حصلت على فرص كافية للتطبيق؟ وما الذي تمنيت أن تعرفه قبل أن تبدأ؟",
    bodyHelp: (min: number) =>
      `اكتب ${formatNumber(min)} حرفا على الأقل. اذكر تفاصيل عملية تفيد الطالب الذي سيتدرب بعدك.`,
    bodyCountRemaining: (written: number, remaining: number) =>
      `${arCount(written, {
        zero: "0 حرف",
        one: "حرف واحد",
        two: "حرفان",
        few: "{n} أحرف",
        many: "{n} حرفًا",
      })} — بقي ${formatNumber(remaining)}`,
    bodyCount: (written: number) =>
      arCount(written, {
        zero: "0 حرف",
        one: "حرف واحد",
        two: "حرفان",
        few: "{n} أحرف",
        many: "{n} حرفًا",
      }),

    scanHeading: "راجع النص قبل النشر؛ قد يحتوي على معلومات تكشف هوية شخص.",
    scanItem: (label: string) => `قد يحتوي النص على ${label}`,
    scanFooter:
      "هذا تنبيه آلي وقد لا يكون دقيقا. إذا كانت المعلومة آمنة، يمكنك المتابعة.",
    scanName: "اسم شخص",
    scanPhone: "رقم هاتف",
    scanEmail: "بريد إلكتروني",
    scanHandle: "حساب على منصة تواصل",
    scanDate: "تاريخ محدّد",

    fieldLabel: "تخصصك — مطلوب",
    fieldPlaceholder: "اختر تخصصك",
    fieldHint:
      "نستخدم تخصصات عامة حتى لا تكشف المراجعة هويتك داخل دفعة صغيرة.",

    roleLabel: "مرحلة التدريب — مطلوب",
    rolePlaceholder: "اختر مرحلتك",
    roleHint:
      "تساعد هذه المعلومة القارئ على فهم تجربتك في سياقها.",

    detailsSummary: "تفاصيل إضافية — اختيارية",
    titleLabel: "ملخص التجربة في سطر",
    titlePlaceholder: "مزدحم، وتعليم جيد، ولا مكان للجلوس",

    axesLegend: "قيم جوانب التدريب",

    departmentLabel: "القسم أو الوحدة",
    departmentPlaceholder: "الطوارئ، العناية المركزة، صيدلية التنويم…",
    departmentHint:
      "اختياري. اتركه فارغا إذا كان ذكر القسم مع السنة قد يكشف هويتك.",

    yearLabel: "سنة تدريبك",
    yearNotSaying: "أفضّل عدم الذكر",
    yearHint:
      "اذكر السنة فقط. لا تكتب الشهر، خصوصا إذا كان القسم صغيرا.",

    submit: "انشر المراجعة",
    submitting: "جاري النشر…",
    saveChanges: "احفظ التعديلات",
    signedInAs: (username: string) =>
      `ستنشر المراجعة باسم ‎@${username}. حسابك لا يحتوي على بريد إلكتروني أو اسم حقيقي.`,
    signedOutNote:
      "يمكنك الكتابة الآن. سنطلب تسجيل الدخول عند النشر، وستبقى مسودتك محفوظة على هذا الجهاز.",
  },

  auth: {
    signInTitle: "تسجيل الدخول",
    signInMetaDescription:
      "سجل الدخول باستخدام اسم المستخدم وكلمة المرور. لا نستخدم البريد الإلكتروني.",
    signInLede:
      "تحتاج إلى تسجيل الدخول فقط لكتابة مراجعة أو تعليق أو للتصويت. القراءة متاحة للجميع.",
    signInNoReset:
      "لا يوجد بريد إلكتروني مرتبط بالحساب. إذا فقدت كلمة المرور ورمز الاستعادة معا، فلن نتمكن من استعادة حسابك.",
    noAccountYet: "ليس لديك حساب؟",
    createOne: "أنشئ واحدًا",
    createOneSuffix: " — اسم مستخدم وكلمة مرور فقط.",

    signUpTitle: "إنشاء حساب",
    signUpMetaDescription:
      "أنشئ حسابا باسم مستخدم وكلمة مرور فقط، بدون بريد إلكتروني أو اسم حقيقي.",
    signUpLede: "اسم مستخدم وكلمة مرور فقط. لا نطلب أي معلومات شخصية.",
    accountHoldsHeading: "ماذا نحفظ في حسابك؟",
    weKeep: "ما نحتفظ به",
    weNeverAsk: "ما لا نطلبه أبدًا",
    stored: [
      "اسم المستخدم الذي تختاره، وهو الاسم الوحيد الذي يظهر مع ما تنشره.",
      "بصمة أحادية الاتجاه لكلمة المرور، ولا يمكن تحويلها إلى كلمة المرور الأصلية.",
      "تاريخ إنشاء الحساب ومراجعاتك وتعليقاتك وتصويتاتك.",
    ],
    notStored: [
      "البريد الإلكتروني؛ لا يوجد له حقل في الموقع.",
      "الاسم الحقيقي أو الجامعة أو البرنامج أو الرقم الجامعي.",
      "تواريخ التدريب الدقيقة؛ يمكنك ذكر السنة فقط.",
      "بيانات التحليلات أو التتبع من خدمات خارجية.",
    ],
    recoveryWarning:
      "سيظهر رمز الاستعادة مرة واحدة بعد إنشاء الحساب. احفظه في مكان آمن؛ فهو الطريقة الوحيدة لاستعادة الحساب إذا نسيت كلمة المرور.",
    alreadyHaveAccount: "لديك حساب بالفعل؟",
    signIn: "سجّل الدخول",

    usernameLabel: "اسم المستخدم",
    usernameHint:
      "من 3 إلى 24 حرفا. استخدم حروفا أو أرقاما أو - أو _. اختر اسما لا يكشف هويتك.",
    passwordLabel: "كلمة المرور",
    passwordHint:
      "10 أحرف على الأقل. استخدم عبارة طويلة يسهل عليك تذكرها ويصعب تخمينها.",
    submitSignIn: "تسجيل الدخول",
    submitSignUp: "إنشاء الحساب",
    signingIn: "جاري تسجيل الدخول…",
    creatingAccount: "جاري إنشاء الحساب…",

    alreadySignedIn: (username: string) =>
      `أنت مسجل الدخول بالفعل باسم ${username}. سجل الخروج أولا إذا أردت إنشاء حساب آخر.`,
    yourAccount: "حسابك",
    signOut: "تسجيل الخروج",

    accountCreated: "تم إنشاء الحساب",
    signedInAs: (username: string) => `أنت مسجَّل الدخول باسم ${username}.`,
    recoverySaveWarning:
      "احفظ هذا الرمز في مكان آمن. ستحتاج إليه إذا نسيت كلمة المرور، لأنه لا يوجد بريد إلكتروني لإعادة تعيينها.",
    recoveryCodeLabel: "رمز الاستعادة",
    copyCode: "انسخ الرمز",
    copied: "تم نسخ الرمز.",
    copyBlocked: "تعذر النسخ. حدد الرمز وانسخه يدويا.",
    recoveryConfirm: "حفظت الرمز في مكان آمن.",
    continue: "متابعة",
    tickTheBox: "حدد المربع بعد حفظ الرمز في مكان آمن.",

    layoutNote: "القراءة متاحة للجميع بدون حساب",
    layoutFooterPrefix:
      "الحساب يحتاج اسم مستخدم وكلمة مرور فقط. لمعرفة ما نحفظه، اقرأ ",
    layoutFooterLink: "سياسة الخصوصية",
  },

  account: {
    metaTitle: "حسابك",
    securityMetaTitle: "كلمة المرور والحساب",

    tabsLabel: "الحساب",
    tabAccount: "الحساب",
    tabSecurity: "الأمان",

    signOutHeading: "تسجيل الخروج من هذا الجهاز",
    signOutBodyPrefix: "ستبقى مسجلا في أجهزتك الأخرى. يمكنك أيضا اختيار ",
    signOutBodyLink: "تسجيل الخروج من كل الأجهزة",
    signOutBodySuffix: ".",
    signOut: "تسجيل الخروج",

    signedInAs: "مسجل الدخول باسم",
    usernameNote: (username: string, joined: string) =>
      `هذا هو الاسم الذي يظهر مع ما تنشره: ‎@${username}. تاريخ إنشاء الحساب: ${joined}.`,

    contributions: "مساهماتك",
    reviews: "المراجعات",
    comments: "التعليقات",

    holdsLabel: "بيانات الحساب",
    holdsHeading:
      "لا نحفظ بريدا إلكترونيا أو اسما حقيقيا أو جامعة.",
    holdsBody:
      "نحفظ اسم المستخدم وبصمة آمنة لكلمة المرور وتاريخ إنشاء الحساب وما نشرته فقط. لا توجد لدينا وسيلة للتواصل معك.",

    yourReviews: "مراجعاتك",
    mostRecentOf: (shown: number, total: number) =>
      `أحدث ${formatNumber(shown)} من ${formatNumber(total)}`,
    noReviewsPrefix: "لم تكتب أي مراجعة بعد. ",
    noReviewsLink: "ابحث عن مكان تدريبك",
    noReviewsSuffix: " وشارك تجربتك.",

    actionsLabel: "إجراءات الحساب",
    passwordAndAccount: "كلمة المرور والحساب",

    securityHeading: "كلمة المرور والحساب",
    securitySignedInAs: "مسجل الدخول باسم",
    recoveryUnused:
      "رمز الاستعادة ما زال صالحا. احتفظ به في مكان آمن؛ فهو الطريقة الوحيدة لاستعادة حسابك إذا نسيت كلمة المرور.",
    recoveryUsed:
      "تم استخدام رمز الاستعادة لهذا الحساب. إذا نسيت كلمة المرور لاحقا، فلن نتمكن من استعادة الحساب لعدم وجود بريد إلكتروني.",

    changePassword: "تغيير كلمة المرور",
    changePasswordBody:
      "عند تغيير كلمة المرور، سيتم تسجيل خروجك من جميع الأجهزة الأخرى، وسيبقى هذا الجهاز مسجلا.",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    newPasswordHint: "10 أحرف على الأقل.",
    confirmPassword: "أعد كتابة كلمة المرور الجديدة",
    changePasswordSubmit: "غيّر كلمة المرور",
    changingPassword: "جاري التغيير…",

    signOutEverywhere: "تسجيل الخروج من كل الأجهزة",
    signOutEverywhereBody:
      "سيتم تسجيل خروجك من جميع الأجهزة، بما فيها هذا الجهاز. لن تتغير كلمة المرور ويمكنك تسجيل الدخول بعدها مباشرة.",
    signingOut: "جاري تسجيل الخروج…",

    deleteAccount: "حذف الحساب",
    deleteBody:
      "سيتم حذف حسابك وبيانات تسجيل الدخول وتصويتاتك نهائيا، ولا يمكن التراجع عن ذلك.",
    deleteKeepsContent: (reviews: number, comments: number) =>
      `سيبقى المحتوى الذي نشرته متاحا باسم ‎@deleted حتى لا تتأثر التقييمات والنقاشات. يشمل ذلك ${arCount(reviews, {
        zero: "0 مراجعة",
        one: "مراجعة واحدة",
        two: "مراجعتين",
        few: "{n} مراجعات",
        many: "{n} مراجعة",
      })} و${arCount(comments, {
        zero: "0 تعليق",
        one: "تعليق واحد",
        two: "تعليقين",
        few: "{n} تعليقات",
        many: "{n} تعليق",
      })}. لن يظهر اسم المستخدم الخاص بك معها.`,
    deleteNothingPosted:
      "لم تنشر أي محتوى، لذلك لن يبقى شيء بعد حذف الحساب.",
    yourPassword: "كلمة مرورك",
    deleteConfirm:
      "أفهم أن حذف الحساب نهائي، وأن مراجعاتي وتعليقاتي ستبقى منشورة بدون اسم المستخدم.",
    deleteSubmit: "احذف حسابي",
    deleting: "جاري الحذف…",

    layoutBrowse: "تصفّح المنشآت",
    layoutStore: "ما الذي نحتفظ به",
    layoutGuidelines: "إرشادات المراجعات",
  },

  search: {
    metaTitle: "بحث",
    metaTitleFor: (q: string) => `بحث: ${q}`,

    heading: "بحث",
    lede: "ابحث باسم المستشفى أو العيادة أو المدينة، وشاهد تجارب الطلاب في أماكن التدريب.",
    formLabel: "ابحث عن منشأة أو مدينة",
    placeholder: "مستشفى أو عيادة أو مدينة",
    submit: "بحث",

    browseAll: "تصفّح كل المنشآت",
    browseByCity: "تصفّح حسب المدينة",

    resultsFor: (q: string) => `نتائج البحث عن «${q}»`,
    statusNothing: (q: string) => `لا توجد نتائج لبحث «${q}».`,
    status: (facilities: number, cities: number, q: string) =>
      `${arCount(facilities, {
        zero: "0 منشأة",
        one: "منشأة واحدة",
        two: "منشأتان",
        few: "{n} منشآت",
        many: "{n} منشأة",
      })} و${arCount(cities, {
        zero: "0 مدينة",
        one: "مدينة واحدة",
        two: "مدينتان",
        few: "{n} مدن",
        many: "{n} مدينة",
      })} مطابقة لبحث «${q}».`,

    emptyTitle: (q: string) => `لا نتائج لـ «${q}»`,
    emptyBody:
      "جرب كتابة اسم أقصر أو ابحث باسم المدينة. إذا لم تكن منشأتك موجودة، يمكنك إضافتها خلال دقيقة.",
    addThisFacility: "إضافة منشأة",

    citiesHeading: "المدن",
    facilitiesHeading: "المنشآت",
    allResultsWithFilters: "عرض النتائج مع خيارات التصفية",
    refineResults: "تصفية النتائج",
  },

  moderate: {
    metaTitle: "قائمة البلاغات",
    eyebrow: "الإشراف",
    heading: "البلاغات المفتوحة",
    nothingToDo: "لا توجد بلاغات مفتوحة.",
    targetDeleted: "تم حذف المحتوى المبلغ عنه",
    statusLabel: (status: string) => `الحالة: ${status}`,
    viewInContext: "اعرضه في سياقه",
    removeContent: "احذف المحتوى",
    dismissReport: "تجاهل البلاغ",
    targetReview: "مراجعة",
    targetComment: "تعليق",
    targetFacility: "منشأة",
  },

  static: {
    about: {
      metaTitle: "عن الموقع",
      metaDescription:
        "Tellyrate منصة لتجارب طلاب التخصصات الصحية في مستشفيات ومنشآت السعودية، يكتبها الطلاب الذين تدربوا فيها.",
      eyebrow: "عن الموقع",
      heading: "تجارب حقيقية عن أماكن التدريب",
      lede: "يجمع Tellyrate تجارب طلاب التخصصات الصحية في المستشفيات والعيادات والمراكز الصحية، حتى تعرف ما الذي ينتظرك قبل أن تختار مكان تدريبك.",

      whyTitle: "لماذا أنشأنا Tellyrate؟",
      whyP1:
        "مكان التدريب يصنع فرقا كبيرا في تجربتك، لكن أغلب المعلومات تنتقل بالكلام بين الطلاب. قد يخبرك زميل أن قسما ممتاز، ويقول آخر إن التدريب في مكان آخر كان مجرد مشاهدة. هذه المعلومات تضيع مع كل دفعة، ويضطر الطلاب إلى البدء من الصفر.",
      whyP2:
        "Tellyrate يجمع هذه التجارب في مكان واحد. مراجعة واحدة تعبر عن تجربة شخص، لكن تكرار الملاحظات نفسها من طلاب وتخصصات مختلفة يعطي صورة أوضح.",

      reviewTitle: "ماذا تتضمن المراجعة؟",
      reviewP1:
        "تتضمن كل مراجعة تقييما عاما ووصفا للتجربة. ويمكن للطالب أيضا تقييم ستة جوانب مهمة:",
      reviewAxes: [
        "الإشراف والتعليم — هل وجدت من يشرح لك ويتابعك؟",
        "التطبيق العملي — هل حصلت على فرص حقيقية للمشاركة؟",
        "التعامل مع الطلاب — هل كان الفريق محترما ومتعاونا؟",
        "ساعات وحجم العمل — هل كان الجدول واضحا ومعقولا؟",
        "المرافق والتجهيزات — هل توفرت لك الاحتياجات الأساسية؟",
        "السلامة والدعم — هل كانت إجراءات السلامة واضحة؟ وهل تم التعامل مع الملاحظات بجدية؟",
      ],
      reviewP2:
        "تظهر المراجعة أيضا تخصصك ومرحلة تدريبك، مثل «الصيدلة · امتياز». ذكر القسم اختياري لأن أسماء الأقسام تختلف من منشأة إلى أخرى.",
      reviewP3:
        "نطلب سنة التدريب فقط، ولا نعرضها بدقة في المنشآت التي لديها عدد قليل من المراجعات. الهدف هو منع ربط المراجعة بطالب معين.",

      accountsTitle: "القراءة للجميع، والكتابة تحتاج إلى حساب",
      accountsP1:
        "يمكن لأي شخص تصفح المنشآت وقراءة المراجعات ومشاركة الصفحات بدون تسجيل الدخول.",
      accountsP2Prefix:
        "كتابة مراجعة أو تعليق أو التصويت تحتاج إلى حساب حتى نحافظ على موثوقية التقييمات. الحساب عبارة عن اسم مستخدم وكلمة مرور فقط؛ لا نطلب بريدا إلكترونيا أو رقم هاتف أو اسما حقيقيا أو جامعة. ",
      accountsP2Link: "صفحة الخصوصية",
      accountsP2Suffix: " توضح بالتفصيل ما الذي نحفظه وما الذي لا نجمعه.",

      rankingTitle: "كيف يعمل الترتيب",
      rankingHighestRated: "«الأعلى تقييمًا»",
      rankingP1:
        " لا يعتمد على المتوسط وحده؛ فتقييم واحد بخمس نجوم لا يجب أن يتفوق على منشأة لديها عشرات المراجعات. نستخدم متوسطا موزونا يأخذ عدد المراجعات في الحسبان، لذلك تتحسن مرتبة المنشأة مع وجود تقييمات متقاربة من عدد كاف من الطلاب.",
      rankingMostHelpful: "«الأكثر إفادة»",
      rankingP2:
        " يرتب المراجعات بطريقة تراعي عدد التصويتات ونسبة من وجدوها مفيدة، حتى لا تتصدر مراجعة لأنها حصلت على تصويت واحد فقط.",
      rankingP3:
        "الترتيب غير مدفوع. لا تستطيع أي منشأة الدفع لرفع ترتيبها أو إضافة مراجعة أو حذفها.",

      dataTitle: "من أين تأتي بيانات المنشآت؟",
      dataP1:
        "نستورد أسماء المنشآت وأنواعها ومواقعها وبيانات التواصل المتوفرة من OpenStreetMap. ترتبط كل منشأة بمعرفها هناك، لذلك يؤدي تحديث البيانات إلى تعديل السجل بدلا من تكراره.",
      dataP2:
        "جودة البيانات تختلف من منشأة إلى أخرى. قد يكون الاسم متوفرا بالعربية فقط أو بالإنجليزية فقط، وقد لا يتوفر العنوان أو رقم الهاتف.",
      dataP3:
        "إذا لم تجد مكان تدريبك، يمكنك إضافته بعد التأكد من أنه غير موجود. وإذا كانت بيانات منشأة غير صحيحة، يمكنك الإبلاغ عنها أو تصحيحها في OpenStreetMap ليستفيد الجميع.",
      dataLicencePrefix:
        "بيانات المنشآت © مساهمو OpenStreetMap، متاحة بموجب ",
      dataLicenceLink: "رخصة قواعد البيانات المفتوحة (ODbL)",

      notTitle: "ما ليس هذا الموقع",
      notItems: [
        {
          strong: "ليس لتجارب المرضى.",
          text: " المراجعات هنا عن بيئة التدريب والتعليم، وليست عن جودة العلاج أو تجربة المريض.",
        },
        {
          strong: "ليس قناة رسمية للشكاوى.",
          text: " إذا حدث أمر يتعلق بالسلامة أو يحتاج إلى تدخل رسمي، استخدم قناة البلاغات المعتمدة في جهتك. كتابة مراجعة هنا لا تستبدل البلاغ الرسمي.",
        },
        {
          strong: "ليس بدون إشراف على المحتوى.",
          text: " سنحذف أي محتوى يذكر أسماء العاملين أو معلومات المرضى، وقد نحظر الحساب عند تكرار المخالفة.",
        },
      ],
      notGuidelinesLink: "إرشادات الكتابة",
      notGuidelinesSuffix: " توضّح أين يقع الخط الفاصل.",

      whoTitle: "من يدير Tellyrate؟",
      whoP1:
        "Tellyrate مشروع مستقل وغير تابع لأي مستشفى أو جامعة أو وزارة أو هيئة مهنية. لا توجد إعلانات أو رعايات أو نتائج مدفوعة، ولا نبيع بيانات المستخدمين.",
      whoP2:
        "إذا وجدت مشكلة، استخدم زر الإبلاغ في المراجعة أو التعليق أو صفحة المنشأة. يراجع شخص حقيقي كل بلاغ.",

      relatedLabel: "صفحات ذات صلة",
      relatedGuidelines: "إرشادات كتابة المراجعات",
      relatedPrivacy: "الخصوصية",
      relatedBrowse: "تصفّح المنشآت",
    },

    guidelines: {
      metaTitle: "إرشادات كتابة المراجعات",
      metaDescription:
        "كيف تكتب مراجعة مفيدة وتحافظ على خصوصيتك وخصوصية الآخرين.",
      eyebrow: "الإرشادات",
      heading: "اكتب مراجعة مفيدة وآمنة",
      lede: "شارك تفاصيل تساعد الطالب الذي سيتدرب بعدك، واحرص على أن تكون المراجعة عن المكان والتجربة، لا عن أشخاص بأسمائهم.",
      hardRule:
        "القاعدة الأساسية: اكتب عن المكان والتدريب، ولا تذكر أسماء العاملين أو أي معلومات عن المرضى.",

      peopleTitle: "ركز على المكان، وليس الأشخاص",
      peopleP1:
        "لا تذكر اسم أي شخص من العاملين، ولا تكتب وصفا يجعل التعرف عليه سهلا، مثل المسمى الوظيفي مع القسم واليوم. يمكنك انتقاد أسلوب العمل أو الإشراف في القسم، لكن لا تحول المراجعة إلى هجوم شخصي.",
      peopleP2:
        "صف المشكلة بطريقة تساعد على فهمها وإصلاحها. بدلا من «الاستشاري تجاهلنا»، اكتب «لم يكن هناك مشرف متاح للطلاب بعد الساعة الرابعة في أغلب الأيام». بهذه الطريقة توضح ما قد يواجهه الطالب التالي بدون استهداف شخص.",
      peopleP3:
        "سنحذف أي مراجعة تكشف هوية شخص، وقد نحظر الحساب عند تكرار المخالفة.",

      patientsTitle: "المرضى ليسوا مادة للكتابة",
      patientsP1:
        "لا تذكر أي معلومات عن المرضى: لا أسماء أو أحرف أولى أو أرقام ملفات أو غرف أو تفاصيل عن حالات نادرة. جمع الحالة مع القسم والتاريخ قد يجعل التعرف على المريض ممكنا.",
      patientsP2:
        "إذا لم تستطع شرح الموقف بدون معلومات سريرية، فلا تنشره هنا. ناقشه مع مشرفك عبر القنوات المناسبة.",

      usefulTitle: "ما الذي يجعل المراجعة نافعة",
      usefulItems: [
        {
          strong: "اذكر تفاصيل واضحة.",
          text: " مثل: «كان معنا مشرف واحد لكل أربعة طلاب، وبدأنا أخذ التاريخ المرضي من اليوم الثاني». هذا يفيد أكثر من «المستشفى جيد والفريق لطيف».",
        },
        {
          strong: "اكتب عن تجربتك أنت.",
          text: " لا تنقل كلاما سمعته عن قسم آخر أو تجربة لم تحضرها بنفسك.",
        },
        {
          strong: "لا تتجاهل التفاصيل اليومية.",
          text: " هل كانت البطاقة جاهزة؟ هل وصل الجدول مبكرا؟ هل يوجد مكان لتبديل الملابس والأكل والجلوس والصلاة؟ هذه التفاصيل تهم المتدرب فعلا.",
        },
        {
          strong: "وضح كيف يمكن أن تتحسن التجربة.",
          text: " لا تكتف بقول «التعليم ضعيف». اذكر ما كان ينقصك، مثل جولة تعليمية واضحة أو وقت محدد لمناقشة الحالات.",
        },
        {
          strong: "كن منصفا.",
          text: " يوم سيئ واحد لا يختصر فترة تدريب كاملة. حاول وصف النمط العام واذكر الإيجابيات والسلبيات.",
        },
        {
          strong: "لا تحتاج إلى كتابة نص طويل.",
          text: " أربع جمل واضحة قد تكون أفضل من ثلاث فقرات عامة.",
        },
      ],

      ratingsTitle: "تقييم المحاور الستة",
      ratingsP1:
        "التقييم العام مطلوب، أما الجوانب الستة الأخرى فهي اختيارية. اترك أي جانب فارغا إذا لم تستطع تقييمه؛ فعدم الإجابة أفضل من التخمين.",
      ratingsP2:
        "قيم كل جانب بشكل مستقل. قد يكون التعليم ممتازا بينما تكون الساعات مرهقة، وإظهار هذا الفرق يجعل المراجعة أكثر فائدة.",

      protectTitle: "كيف تحمي نفسك",
      protectItems: [
        "اختر اسم مستخدم لا تستخدمه في مواقع أخرى، ولا يتضمن اسمك أو أحرفك الأولى أو سنة تخرجك.",
        "لا تذكر تواريخ دقيقة أو حجم مجموعتك أو تفاصيل فريدة تجعل التعرف عليك سهلا.",
        "إذا كان عدد الطلاب في القسم صغيرا، اكتب عن الأنماط العامة وفكر في ترك خانة القسم فارغة.",
        "لا تذكر شهر التدريب داخل النص. الموقع يخفي دقة السنة عندما يكون عدد المراجعات قليلا لحماية هويتك.",
      ],
      protectPrivacyLink: "صفحة الخصوصية",
      protectPrivacySuffix:
        " توضح ما الذي نحفظه، وما الذي لا يستطيع الموقع حمايتك منه إذا كتبته بنفسك.",

      oneReviewTitle: "مراجعة واحدة لكل مكان تدريب",
      oneReviewP1:
        "يمكن لكل حساب كتابة مراجعة واحدة عن كل منشأة. إذا عدت إلى المكان أو تغير رأيك، عدل مراجعتك بدلا من نشر مراجعة ثانية. سيظهر للقراء أن المراجعة تم تعديلها.",

      commentsTitle: "التعليقات والتصويت",
      commentsP1:
        "استخدم التعليقات للسؤال أو إضافة تحديث مفيد، مثل «تغير الجدول في 2024». أبق النقاش مرتبطا بتجربة التدريب ولا تحوله إلى جدال شخصي.",
      commentsP2:
        "التصويت يجيب عن سؤال واحد: هل كانت المراجعة مفيدة لمن يختار مكان تدريب؟ لا يعني التصويت أنك توافق على رأي الكاتب.",

      removedTitle: "ما الذي يُحذف",
      removedItems: [
        "أي محتوى يكشف هوية أحد العاملين أو المرضى.",
        "التحرّش أو الإساءة أو التهديد.",
        "الرسائل المزعجة والإعلانات ومنشورات التوظيف.",
        "مراجعات عن منشأة لم يتدرب فيها الكاتب.",
        "معلومات مضللة أو ادعاءات غير صحيحة.",
        "محتوى لا علاقة له بالتدريب السريري.",
      ],
      removedP1:
        "استخدم زر الإبلاغ الموجود في أي مراجعة أو تعليق أو صفحة منشأة. نحفظ سبب البلاغ والملاحظة الاختيارية والحساب الذي أرسله، ويراجع شخص حقيقي كل بلاغ.",

      facilitiesTitle: "إذا كنت تعمل في منشأة لها مراجعات هنا",
      facilitiesP1:
        "إذا خالفت مراجعة هذه القواعد، مثل ذكر اسم موظف أو معلومات مريض أو الكتابة عن مكان لم يتدرب فيه الكاتب، أرسل بلاغا وسيراجعه مشرف المحتوى.",
      facilitiesP2:
        "إذا كانت المراجعة سلبية لكنها لا تخالف القواعد، فستبقى منشورة. لا تستطيع المنشآت الدفع لتعديل مراجعة أو حذفها.",

      relatedLabel: "صفحات ذات صلة",
      relatedAbout: "عن Tellyrate",
      relatedPrivacy: "الخصوصية",
      relatedFind: "ابحث عن مكان تدريبك",
    },

    privacy: {
      metaTitle: "الخصوصية",
      metaDescription:
        "تعرف على البيانات التي يحفظها Tellyrate وكيف نحمي خصوصيتك: بدون بريد إلكتروني أو اسم حقيقي أو أدوات تتبع.",
      eyebrow: "الخصوصية",
      heading: "ما الذي نحفظه عنك؟",
      lede: "نوضح هنا البيانات التي يجمعها الموقع، ولماذا نحتاج إليها، وما الذي لا نجمعه من الأساس.",

      accountTitle: "اسم مستخدم وكلمة مرور فقط",
      accountP1:
        "عند إنشاء الحساب نطلب اسم مستخدم وكلمة مرور فقط. نحفظ اسم المستخدم، وبصمة أحادية الاتجاه لكل من كلمة المرور ورمز الاستعادة إن أنشأته، وحالة الحساب، وتاريخ إنشائه.",
      accountP2:
        "لا يوجد حقل للبريد الإلكتروني في قاعدة البيانات. ولا نطلب اسمك الحقيقي أو رقم هاتفك أو تاريخ ميلادك أو جامعتك أو سنة تخرجك أو صورتك الشخصية.",

      passwordsTitle: "كلمات المرور",
      passwordsP1:
        "لا نحفظ كلمة المرور بصورتها الأصلية. نحولها باستخدام خوارزمية scrypt وقيمة عشوائية مختلفة لكل حساب إلى بصمة أحادية الاتجاه. لذلك لا يستطيع مشرف الموقع قراءة كلمة مرورك أو استعادتها من البصمة.",
      passwordsP2:
        "بسبب عدم وجود بريد إلكتروني أو معلومات تثبت هويتك، لا نستطيع استعادة الحساب إذا فقدت كلمة المرور ورمز الاستعادة معا. احفظ رمز الاستعادة في مكان آمن.",

      sessionsTitle: "الجلسات وملفات تعريف الارتباط",
      sessionsP1:
        "عند تسجيل الدخول نستخدم ملف ارتباط باسم tellyrate_session لإبقاء حسابك مسجلا. يتم ضبطه ليكون محميا من قراءة سكربتات الصفحة، ولا يرسل عبر اتصال غير مشفر في الموقع المباشر، وتنتهي صلاحيته بعد 30 يوما مع تمديدها أثناء الاستخدام.",
      sessionsP2:
        "يحمل الملف رمزا عشوائيا، بينما نحفظ في قاعدة البيانات بصمة آمنة لهذا الرمز. تسجيل الخروج يحذف الجلسة، وخيار تسجيل الخروج من جميع الأجهزة يحذف كل جلسات حسابك.",
      sessionsP3:
        "نستخدم ملف ارتباط آخر باسم tellyrate-locale لتذكر اللغة التي اخترتها. لا نستخدم ملفات ارتباط للتحليلات أو الإعلانات أو خدمات خارجية.",

      storageTitle: "التخزين المحلي في متصفحك",
      storageP1:
        "نحفظ في متصفحك اختيار المظهر الفاتح أو الداكن، ومسودة المراجعة التي تكتبها حتى لا تضيع إذا غادرت الصفحة أو سجلت الدخول. تبقى المسودة لمدة 14 يوما أو حتى تنشرها، ويمكنك حذفها بمسح بيانات الموقع. هذه البيانات تبقى على جهازك ولا ترسل إلى الخادم.",

      addressesTitle: "لا نحفظ عناوين IP",
      addressesP1:
        "نحتاج إلى الحد من الرسائل المزعجة ومحاولات إساءة الاستخدام، لكننا لا نريد إنشاء سجل يربط نشاطك بعنوان IP.",
      addressesP2:
        "للحد من عدد الطلبات، نحول عنوان IP إلى بصمة مؤقتة باستخدام HMAC-SHA256 وسر خاص بالخادم مع تاريخ اليوم. نحفظ جزءا من البصمة مع عداد ووقت انتهاء فقط، ولا نحفظ العنوان نفسه أو سجل الصفحات التي زرتها.",
      addressesP3:
        "تتغير البصمة كل يوم، لذلك لا يمكن ربط نشاط اليوم بنشاط الأيام السابقة. نحذف سجلات الحد من الطلبات بعد انتهاء صلاحيتها.",
      addressesP4:
        "بالنسبة إلى IPv6 نستخدم بادئة /64 قبل إنشاء البصمة لتجنب تجاوز الحد عند تغير عنوان الهاتف. وعندما تكون مسجلا، نعتمد على معرف الحساب لتحديد الطلبات ولا نعالج عنوان IP لهذا الغرض.",

      thirdPartiesTitle: "لا أطراف خارجية، والمتصفح هو من يفرض ذلك",
      thirdPartiesP1:
        "لا نستخدم أدوات تحليل أو إعلانات أو تسجيل جلسات أو خرائط وفيديوهات مدمجة أو أزرار تواصل من خدمات خارجية. الخطوط موجودة على خادم الموقع نفسه، لذلك لا يتصل متصفحك بخدمة خطوط خارجية عند فتح الصفحة.",
      thirdPartiesP2:
        "يفرض الموقع سياسة أمان تمنع الصفحة من الاتصال بخوادم غير مصرح بها أو الظهور داخل إطار في موقع آخر. كما لا نرسل عنوان الصفحة السابقة عند فتح رابط خارجي، ونعطل وصول الموقع إلى الكاميرا والميكروفون والموقع الجغرافي والإعلانات القائمة على الاهتمامات.",

      publicTitle: "ما هو علني",
      publicP1:
        "كل ما تنشره متاح للعامة وقد يظهر في محركات البحث. يشمل ذلك اسم المستخدم، ونص المراجعة وتقييماتها، وتعليقاتك، وتخصصك ومرحلة تدريبك، والقسم إذا ذكرته، ونطاق سنة التدريب، ومجموع التصويتات.",
      publicP2:
        "لا نعرض أسماء المصوتين. يرى كل مستخدم تصويته فقط، ولا نرسل قائمة المصوتين إلى المتصفح.",

      limitsTitle: "حدود إخفاء الهوية",
      limitsP1:
        "عدم طلب البريد الإلكتروني والاسم الحقيقي يقلل البيانات التي نعرفها عنك، لكنه لا يمنع الآخرين من التعرف عليك من التفاصيل التي تكتبها.",
      limitsP2Prefix:
        "إذا كنت الطالب الوحيد في قسم معين، أو وصفت موقفا يعرفه كل من كان هناك، فقد يتعرف عليك أحد زملائك. فكر جيدا في التفاصيل التي تنشرها. ",
      limitsP2Link: "إرشادات الكتابة",
      limitsP2Suffix:
        " تقدم نصائح لكتابة مراجعة مفيدة بدون كشف هويتك أو هوية غيرك.",
      limitsP3:
        "تذكر أن حذف المراجعة من الموقع لا يضمن حذف نسخة حفظها محرك بحث أو شخص التقط صورة للشاشة.",

      hostingTitle: "شركة الاستضافة والشبكة",
      hostingP1:
        "يعمل الموقع على خوادم وشبكات تديرها شركات استضافة. قد تتمكن هذه الشركات من رؤية بيانات الاتصال الأساسية مثل عنوان IP ووقت الطلب والصفحة المطلوبة، وفقا لسياساتها.",
      hostingP2:
        "تطبيق Tellyrate لا يطلب هذه السجلات من شركة الاستضافة ولا يحفظ نسخة منها. تحتوي النسخ الاحتياطية لقاعدة البيانات على البيانات الموضحة في هذه الصفحة فقط.",

      requestsTitle: "إذا طلبت جهة رسمية بيانات حسابك",
      requestsP1:
        "إذا طلبت جهة مختصة البيانات المحفوظة عن حساب، فالمتوفر لدينا هو:",
      requestsItems: [
        "اسم المستخدم",
        "بصمة أحادية الاتجاه لكلمة المرور",
        "بصمة أحادية الاتجاه لرمز الاستعادة إن وجد",
        "صلاحية الحساب وحالة الحظر وتاريخ الإنشاء",
        "المراجعات والتعليقات والتصويتات المرتبطة بالحساب",
      ],
      requestsP2:
        "لا يوجد لدينا بريد إلكتروني أو رقم هاتف أو سجل لعناوين IP أو سجل تصفح، لأننا لا نجمع هذه البيانات من الأصل.",

      changesTitle: "تحديثات سياسة الخصوصية",
      changesP1:
        "سنحدث هذه الصفحة إذا تغيرت طريقة عمل الموقع أو بدأنا في جمع نوع جديد من البيانات. ما لم نذكر نوعا من البيانات هنا، فنحن لا نجمعه.",

      relatedLabel: "صفحات ذات صلة",
      relatedAbout: "عن Tellyrate",
      relatedGuidelines: "إرشادات كتابة المراجعات",
    },
  },

  errors: {
    errorEyebrow: "خطأ",
    errorTitle: "حدث خطأ",
    errorBody:
      "تعذر عرض الصفحة الآن. لم يتم إرسال أي شيء كنت تكتبه. حاول مرة أخرى، وإذا استمرت المشكلة ارجع إلى الصفحة الرئيسية.",
    tryAgain: "حاول مرة أخرى",
    browseFacilities: "تصفّح المنشآت",
    home: "الرئيسية",
    reference: (digest: string) => `الرقم المرجعي ${digest}`,

    notFoundEyebrow: "خطأ 404",
    notFoundTitle: "الصفحة غير موجودة",
    notFoundBody:
      "قد يكون الرابط غير صحيح أو تغير عنوان الصفحة. ابحث عن المنشأة بالاسم أو تصفح المدن للعثور عليها.",
    notFoundNavLabel: "يمكنك المتابعة من هنا",
    searchFacilities: "ابحث في المنشآت",
    browseByCity: "تصفّح حسب المدينة",

    facilityNotFoundEyebrow: "404 — غير موجود",
    facilityNotFoundTitle: "لم نجد هذه المنشأة",
    facilityNotFoundBody:
      "قد يكون الرابط قديما أو تم دمج المنشأة مع سجل آخر. ابحث باسمها بالعربية أو الإنجليزية للعثور عليها.",
  },

  labels: {
    siteCountryName: "المملكة العربية السعودية",

    facilityFallback: "منشأة",
    studentFallback: "طالب",
    traineeFallback: "متدرّب",
    healthcareFallback: "تخصص صحي",
    notVisible: "غير ظاهرة",

    facilityKind: {
      HOSPITAL: "مستشفى",
      CLINIC: "عيادة",
      HEALTH_CENTER: "مركز صحي",
      DENTAL_CLINIC: "عيادة أسنان",
      PHARMACY: "صيدلية",
      LABORATORY: "مختبر",
      REHAB_CENTER: "مركز تأهيل",
      MENTAL_HEALTH: "منشأة للصحة النفسية",
      OTHER: "أخرى",
    },

    facilityKindPlural: {
      HOSPITAL: "مستشفيات",
      CLINIC: "عيادات",
      HEALTH_CENTER: "مراكز صحية",
      DENTAL_CLINIC: "عيادات أسنان",
      PHARMACY: "صيدليات",
      LABORATORY: "مختبرات",
      REHAB_CENTER: "مراكز تأهيل",
      MENTAL_HEALTH: "منشآت الصحة النفسية",
      OTHER: "منشآت أخرى",
    },
    facilityKindPluralFallback: "منشآت",

    studentField: {
      MEDICINE: "الطب",
      NURSING: "التمريض",
      PHARMACY: "الصيدلة",
      DENTISTRY: "طب الأسنان",
      LABORATORY: "علوم المختبرات",
      RADIOLOGY: "الأشعة",
      PHYSIOTHERAPY: "العلاج الطبيعي",
      RESPIRATORY: "العلاج التنفسي",
      NUTRITION: "التغذية",
      EMERGENCY_MEDICAL: "الخدمات الطبية الطارئة",
      PUBLIC_HEALTH: "الصحة العامة",
      OTHER: "تخصص آخر",
    },

    traineeRole: {
      STUDENT: "طالب تدريب سريري",
      SUMMER_TRAINEE: "متدرب صيفي",
      INTERN: "متدرب امتياز",
      RESIDENT: "مقيم",
      FELLOW: "زميل",
      OBSERVER: "متدرب ملاحظة",
      OTHER: "صفة أخرى",
    },

    traineeRoleShort: {
      STUDENT: "طالب",
      SUMMER_TRAINEE: "تدريب صيفي",
      INTERN: "امتياز",
      RESIDENT: "مقيم",
      FELLOW: "زميل",
      OBSERVER: "ملاحظة",
      OTHER: "متدرب",
    },

    ratingAxis: {
      supervision: {
        label: "الإشراف والتعليم",
        hint: "هل وجدت من يشرح لك ويتابع تقدمك؟",
      },
      handsOn: {
        label: "التطبيق العملي",
        hint: "هل حصلت على فرص كافية للمشاركة والتطبيق؟",
      },
      staffRespect: {
        label: "التعامل مع الطلاب",
        hint: "هل كان الفريق محترما ومتعاونا مع الطلاب؟",
      },
      workload: {
        label: "ساعات وحجم العمل",
        hint: "هل كان الجدول واضحا وساعات التدريب معقولة؟",
      },
      resources: {
        label: "المرافق والتجهيزات",
        hint: "هل توفرت احتياجات المتدربين والتجهيزات اللازمة؟",
      },
      safety: {
        label: "السلامة والدعم",
        hint: "هل كانت إجراءات السلامة واضحة؟ وهل تم التعامل مع الملاحظات بجدية؟",
      },
    },

    reportReason: {
      SPAM: "إزعاج أو إعلانات",
      HARASSMENT: "تحرّش أو إساءة",
      PERSONAL_INFO: "يكشف هوية شخص",
      MISINFORMATION: "معلومات غير صحيحة",
      OFF_TOPIC: "غير متعلق بالتدريب الصحي",
      DUPLICATE: "مكرر",
      OTHER: "شيء آخر",
    },

    country: {
      SA: "المملكة العربية السعودية",
    },

    sort: {
      most_reviewed: "الأكثر مراجعةً",
      highest_rated: "الأعلى تقييما",
      newest: "المضاف حديثا",
      name: "الاسم (أ–ي)",
    },

    reviewSort: {
      helpful: "الأكثر إفادة",
      newest: "الأحدث",
      oldest: "الأقدم",
      highest: "الأعلى تقييما",
      lowest: "الأقل تقييما",
    },

    ratingWords: ["لا أنصح به", "ضعيف", "متفاوت", "جيد", "ممتاز"],

    reviewStatus: {
      PENDING: "بانتظار المراجعة",
      HIDDEN: "أخفاها مشرف المحتوى",
      REMOVED: "حذفها مشرف المحتوى",
    },

    departmentSuggestions: [
      "الطوارئ",
      "الباطنة",
      "الجراحة العامة",
      "الأطفال",
      "النساء والولادة",
      "العناية المركزة",
      "التخدير",
      "العظام",
      "الطب النفسي",
      "الأشعة",
      "القلب",
      "الأورام",
      "طب الأسرة",
      "صيدلية التنويم",
      "صيدلية العيادات الخارجية",
      "الصيدلة الإكلينيكية",
      "المختبر",
      "الأحياء الدقيقة",
      "العلاج الطبيعي",
      "الأسنان",
      "قسم التمريض",
      "العيادات الخارجية",
    ],
  },
};

/* -------------------------------------------------------------------------- */

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "ar";
}
