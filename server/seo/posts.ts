// Blog posts. Plain trusted HTML. Facts come from the sources listed on each post; keep claims within them.

export interface Source { label: string; url: string }
export interface Post {
  slug: string;
  title: string;
  description: string;
  published: string; // YYYY-MM-DD
  body: string;
  sources: Source[];
}

const NHS_REINTRO: Source = { label: "Gloucestershire Hospitals NHS: FODMAP reintroduction information", url: "https://www.gloshospitals.nhs.uk/documents/17365/FODMAP_reintroduction_information_for_website_Feb_23_update.pdf" };
const LEICESTER: Source = { label: "University Hospitals of Leicester NHS: Keeping a food diary when you have symptoms of IBS", url: "https://www.uhleicester.nhs.uk/wp-content/uploads/2025/06/1309_062022-Keeping-a-food-diary-when-you-have-symptoms-of-irritable-bowel-syndrome-IBS.pdf" };
const MONASH_LABELS: Source = { label: "Monash FODMAP: Label reading, how to spot the FODMAPs", url: "https://monashfodmap.com/blog/label-reading/" };
const DVD_REINTRO: Source = { label: "Diet vs Disease: FODMAP reintroduction plan and challenge phase", url: "https://www.dietvsdisease.org/fodmap-reintroduction-challenge-plan/" };

export const POSTS: Post[] = [
  {
    slug: "how-to-find-your-food-triggers",
    title: "How to Find Your Food Triggers (Without Guessing)",
    description: "A practical way to work out which foods may be causing bloating, pain or other symptoms: keep a food and symptom log, look for patterns, then test one thing at a time.",
    published: "2026-10-28",
    sources: [LEICESTER, NHS_REINTRO],
    body: `
<p>If certain meals leave you bloated, crampy or tired, it is tempting to blame the last thing you ate. That is usually wrong, and it is why people end up cutting out half their diet for no reason. Here is a more reliable way to find <strong>possible</strong> triggers.</p>

<h2>1. Write down what you eat and how you feel</h2>
<p>A food and symptom diary is the standard starting point. A hospital IBS leaflet describes its purpose as comparing your symptoms with what has been eaten, to look for possible triggers. It provides four weekly sheets, so plan on <strong>about four weeks</strong> of logging, not a few days.</p>

<h2>2. Check the whole window, not just the last meal</h2>
<p>The same leaflet notes that trigger foods can cause symptoms straight away or within 48 hours. That means a bad evening may have little to do with dinner. When you review your log, look back across the previous day or two.</p>

<h2>3. Look for patterns across groups of foods</h2>
<p>Don't only look at single foods. The leaflet suggests looking for patterns across food groups. If bread, onion sauces and some fruit all show up before symptoms, the pattern may be a type of carbohydrate rather than any one item.</p>

<h2>4. Treat a pattern as a lead, not a verdict</h2>
<p>A food that appears before symptoms several times is a <strong>possible</strong> trigger. It is not proof. Foods you eat almost every day will appear before every symptom simply because they appear before everything. And with only a handful of meals, chance can look a lot like a pattern.</p>

<h2>5. Confirm by testing one thing at a time</h2>
<p>The way dietitians check a suspect is a structured challenge: reintroduce one food or group, in increasing portions over about three days, and watch what happens, before moving on to the next. We cover that in our <a href="/blog/low-fodmap-reintroduction-step-by-step">step-by-step reintroduction guide</a>.</p>

<div class="callout"><strong>Please don't cut out whole food groups on your own.</strong> The hospital leaflet says not to remove food groups without speaking to a healthcare provider or dietitian. And see a clinician promptly if you have blood in your stool, unexplained weight loss, persistent vomiting, trouble swallowing, or symptoms that wake you at night.</div>

<h2>Making the diary easier</h2>
<p>Most people quit paper diaries within a week. Triggerplate lets you log a meal from a photo and a symptom with one tap, then flags possible triggers from your own history. It labels them "possible" until you confirm them with a reintroduction test. <a href="/auth">Try it free</a>.</p>`,
  },
  {
    slug: "low-fodmap-reintroduction-step-by-step",
    title: "Low-FODMAP Reintroduction, Step by Step",
    description: "How the reintroduction (challenge) phase of the low-FODMAP diet works: one group at a time, three days each, rising portions, and how to read the result.",
    published: "2026-10-28",
    sources: [NHS_REINTRO, DVD_REINTRO],
    body: `
<p>The low-FODMAP diet is not meant to be permanent. The restriction phase is a short reset, and <strong>reintroduction</strong> is how you find out which FODMAP groups you actually react to, and how much you can handle. This guide summarizes the method used in NHS patient information, with a second dietitian source for the rest.</p>

<div class="callout">This is general information, not a personal plan. Reintroduction is easier and safer with a registered dietitian, especially if you have other conditions, have lost weight, or have a history of disordered eating.</div>

<h2>The basic rules</h2>
<ul>
<li><strong>One food or group at a time.</strong> If you test two things at once you cannot tell which one caused a reaction.</li>
<li><strong>Each challenge lasts three days.</strong> Day 1 is a standard portion, day 2 is double and day 3 is triple, using the same food each day.</li>
<li><strong>Step up only if you were fine.</strong> Move to the larger portion only if you had no symptoms in the 24 hours after the previous day's portion.</li>
<li><strong>Fructans are tested separately for each food source</strong>, and sorbitol and mannitol are challenged separately too. One tolerated fructan food does not clear the others.</li>
</ul>

<h2>How to read the result</h2>
<ul>
<li><strong>Symptoms you can't tolerate on day 1:</strong> stop. You may retest later with a smaller amount.</li>
<li><strong>Symptoms appear on day 2 or 3:</strong> stop. That usually means you can handle small or moderate amounts but not unlimited amounts.</li>
<li><strong>No symptoms through day 3:</strong> you can generally assume you tolerate that group (except fructans, which need separate tests).</li>
</ul>

<h2>Between challenges</h2>
<p>NHS guidance says to wait until you have had minimal symptoms for at least three days before starting a new challenge, and to let symptoms calm down after a reaction. One dietitian's plan uses three set washout days of strict low-FODMAP eating between challenges and estimates about 9 to 10 weeks for everything if there are no setbacks. Sources differ on the exact washout, so follow whatever your dietitian gives you.</p>

<h2>Why not stay on the strict diet?</h2>
<p>Staying on full restriction for a long time is not recommended. Some FODMAPs act as prebiotics that feed gut bacteria, studies have linked the strict diet with lower fiber, calcium and iron intake, and it makes eating out hard. The goal is the widest diet you can comfortably eat.</p>

<h2>Keeping track</h2>
<p>Reintroduction is mostly bookkeeping: what you ate, which day of the challenge it was, and how you felt in the next 24 hours. Triggerplate has a reintroduction tool that guides you through the three days with daily check-ins, then records whether you reacted or tolerated it. <a href="/auth">Try it free</a>.</p>`,
  },
  {
    slug: "food-and-symptom-diary-what-to-record",
    title: "Food and Symptom Diary: What to Record (and for How Long)",
    description: "What a useful food and symptom diary actually contains, how long to keep one, and how to make it something you will stick with.",
    published: "2026-10-28",
    sources: [LEICESTER],
    body: `
<p>A food diary only helps if it has enough detail to show a pattern and is simple enough that you keep doing it. Here is what to include.</p>

<h2>The basics</h2>
<p>An NHS hospital leaflet for people with IBS symptoms uses a table with these entries for every day of the week:</p>
<ul>
<li>The date</li>
<li>Breakfast, lunch and dinner</li>
<li>Snacks and drinks (fluids count)</li>
<li>Bowel habits and symptoms, using the Bristol Stool Scale, where types 3 and 4 are considered normal</li>
</ul>

<h2>Useful extras</h2>
<p>These are my suggestions rather than part of that leaflet, but they make patterns easier to see:</p>
<ul>
<li><strong>Time.</strong> Eating times and symptom times, so you can see how long after a meal things started.</li>
<li><strong>Severity.</strong> A simple 1 to 5 score beats "bad" and "ok."</li>
<li><strong>Portion size.</strong> Amount often matters as much as the food.</li>
<li><strong>Ingredients in packaged and restaurant food.</strong> Sauces and seasonings hide ingredients you would not guess from the dish name.</li>
</ul>

<h2>How long?</h2>
<p>The leaflet provides four weekly sheets, so about four weeks is a sensible target. Trigger foods can cause symptoms straight away or up to 48 hours later, so a one-day diary will mislead you.</p>

<h2>Reviewing it</h2>
<p>After a couple of weeks, read back through it. Look for foods that appear repeatedly before symptoms, and for patterns across food groups, not just single items. Treat what you find as <em>possible</em> triggers to test, not a list of foods to ban. The leaflet's own advice is not to cut out food groups without speaking to a healthcare provider or dietitian.</p>

<h2>Make it easy enough to keep</h2>
<p>The most common reason diaries fail is effort. Triggerplate takes a photo of your meal to log it, records symptoms in one tap, and does the pattern-spotting for you once there are enough entries. <a href="/auth">Try it free</a>.</p>`,
  },
  {
    slug: "possible-trigger-vs-confirmed-trigger",
    title: "Possible Trigger vs Confirmed Trigger: Why the Difference Matters",
    description: "Why a food that shows up before symptoms isn't automatically a trigger, and how to move from a possible trigger to a confirmed one.",
    published: "2026-10-28",
    sources: [NHS_REINTRO, LEICESTER],
    body: `
<p>Food-tracking apps love to announce "Your trigger is X!" after a few days. Be skeptical of that, including from us. Here is why a pattern in your log is only a starting point.</p>

<h2>Three reasons a pattern can mislead</h2>
<h3>1. Foods you eat daily are always "suspects"</h3>
<p>If you have coffee and bread every day, they appear before every symptom, and before every good day too. A fair comparison needs days when you did <em>not</em> eat the food. Foods eaten almost constantly cannot be judged from a log at all.</p>

<h3>2. Small numbers fool you</h3>
<p>Three bad evenings after garlic could be a real effect or luck. The fewer times a food has appeared, the wider the range of possible true effects. Any honest tracker should show that uncertainty rather than a confident verdict.</p>

<h3>3. Timing is blurry</h3>
<p>Trigger foods can cause symptoms straight away or within 48 hours, so the culprit may not be the last meal. Logs can point at the wrong item.</p>

<h2>How we handle it in Triggerplate</h2>
<ul>
<li>A food is only flagged as a <strong>possible</strong> trigger once it has appeared in at least five meals over at least four different days.</li>
<li>Foods that appear in most of your meals are labeled "too common to tell apart" instead of being blamed.</li>
<li>Each possible trigger shows a range for the true rate, because small samples are uncertain.</li>
<li>Nothing is called <strong>confirmed</strong> unless you have completed a reintroduction test for the matching food group.</li>
</ul>

<h2>How you actually confirm one</h2>
<p>The method used in NHS guidance is a challenge: test one food or group at a time over three days with rising portions (standard, double, triple), and see whether symptoms appear within 24 hours. It is slower than a log but far more convincing, and our <a href="/blog/low-fodmap-reintroduction-step-by-step">reintroduction guide</a> walks through it.</p>

<div class="callout">Even a confirmed reaction doesn't mean you must avoid the food forever. It often tells you how <em>much</em> you can handle. Work with a clinician or dietitian before restricting anything long term.</div>
<p><a class="btn" href="/auth">Try Triggerplate free</a></p>`,
  },
  {
    slug: "hidden-fodmaps-in-packaged-foods",
    title: "Hidden FODMAPs in Packaged Foods: What to Look For on the Label",
    description: "Garlic and onion powder, inulin and other high-FODMAP ingredients hide in sauces, stocks, snacks and yogurts. Here is how to spot them and the limits of label reading.",
    published: "2026-10-28",
    sources: [MONASH_LABELS],
    body: `
<p>You can eat "low-FODMAP" foods all day and still react, because many packaged foods contain FODMAP ingredients you would never guess from the front of the pack. A research dietitian's label-reading guide lists the main ones.</p>

<h2>The usual suspects</h2>
<ul>
<li><strong>Garlic and onion in any form</strong>, including garlic salt, garlic powder, onion salt and onion powder. These turn up in pasta sauces, stocks, flavored chips and crackers, and dips.</li>
<li><strong>Inulin</strong>, added to some yogurts and biscuits.</li>
<li><strong>Fructan</strong> and other fiber additives such as chicory or fructooligosaccharides.</li>
<li><strong>Sweeteners and sugars:</strong> fructose, honey, sorbitol, mannitol, xylitol and isomalt.</li>
<li><strong>Dairy lactose</strong> in products that are not obviously dairy.</li>
<li><strong>Wheat or rye</strong> when they are main ingredients, plus fruit juices and large amounts of fruit pieces.</li>
</ul>

<h2>Order on the label matters</h2>
<p>Ingredients are listed by weight, highest first. An ingredient near the end is present in a small amount. During reintroduction you may be able to try products where a trigger appears late in the list, but, as the guide says, you then need to monitor your tolerance.</p>

<h2>The limits of label reading</h2>
<ul>
<li>Some high-FODMAP ingredients can't always be identified from a label.</li>
<li>Some products that look fine on paper may still cause symptoms, so trial and error is part of the process.</li>
<li>Ingredient tables like the one above are not exhaustive, so each label still needs checking.</li>
<li>Restaurant food has no label at all.</li>
</ul>

<h2>Tracking what you can't see</h2>
<p>Triggerplate reads ingredient lists from a label photo or a product database where it can, and flags garlic and onion powders, inulin and similar ingredients. When it has only a front-of-pack guess, it says so, because an estimate is not a label. <a href="/auth">Try it free</a>.</p>`,
  },
];

export function findPost(slug: string): Post | undefined {
  return POSTS.find(p => p.slug === slug);
}
