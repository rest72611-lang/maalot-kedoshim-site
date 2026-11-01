# מבנה הפרויקט — אתר מעלות קדושים

המסמך מתאר את הקבצים **שקיימים בפועל במאגר**. סעיף 6 מתאר תוספות מתוכננות, והוא מופרד במפורש מהמבנה הקיים.
תיאור הארכיטקטורה נמצא ב־[ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. עץ הקבצים

```
maalot-kedoshim-site/
├── .github/
│   └── workflows/
│       ├── deploy.yml                  פריסה ל־GitHub Pages (push ל־main)
│       └── pull-request-checks.yml     בדיקות ל־Pull Request (Job: pr-checks), בלי פריסה
├── assets/                             נכסי מקור (תמונות, לוגו, PDF)
│   ├── activity/                       תמונות לגלריית "מהנעשה בבית המדרש"
│   │   ├── הרב בנזרי בשיחה.jpg
│   │   └── חלק מהציבור הרב שגדש את בית הכנסת (1).jpg
│   ├── donations/
│   │   └── salvation-story.pdf         סיפורי הישועה (מקושר מתפריט "תרומות")
│   ├── images/                         נכסים קבועים, חובה לבנייה
│   │   ├── donation-qr.png             קוד QR לתרומות
│   │   ├── hero-sign.png               שלט הכניסה (Hero)
│   │   └── logo.pdf                    הלוגו הרשמי (מקור)
│   ├── notices/                        לוח המודעות
│   │   └── bar-mitzvah.pdf
│   └── popup/                          מודעות לחלון הפופאפ בדף הבית
│       ├── README.md                   הוראות הוספה, הסרה וסידור
│       ├── popup.pdf
│       └── אהלי-שם.pdf
├── docs/
│   └── media-removal-vs-git-history.md הסרת מדיה מהאתר לעומת מחיקה מהיסטוריית Git
├── src/
│   ├── build/                          תהליך הבנייה
│   │   ├── build.ts                    ★ נקודת הכניסה של הבנייה
│   │   ├── activity.ts                 גלריית פעילות
│   │   ├── fixed-assets.ts             לוגו, שלט, QR וכריכת סיפור התרומות
│   │   ├── image-dimensions.ts         קריאת מידות PNG/JPEG
│   │   ├── notices.ts                  לוח מודעות (PDF ← תמונה לכל עמוד)
│   │   ├── poppler.ts                  עטיפה ל־pdfinfo / pdftoppm
│   │   └── popup.ts                    מודעות הפופאפ (עמוד ראשון מכל PDF)
│   ├── data/                           תוכן מובנה
│   │   ├── prayer-times.ts             ★ זמני התפילות + ולידציה
│   │   └── site.ts                     שם האתר, שפה, basePath, כתובת הפרודקשן
│   ├── styles/
│   │   └── site.css                    ★ כל העיצוב
│   ├── templates/                      תבניות HTML
│   │   ├── layout.ts                   מבנה משותף: header, ניווט, footer, JS של הניווט
│   │   ├── home.ts                     דף הבית
│   │   ├── prayer-times.ts             עמוד /zmanim/
│   │   ├── popup.ts                    חלון הפופאפ + JS
│   │   └── utils.ts                    escapeHtml
│   └── paths.ts                        בניית נתיבים לפי basePath
├── test/
│   └── build-output.test.ts            ★ בדיקות לתוצר הבנייה (23 בדיקות)
├── .gitattributes                      סופי שורות וקבצים בינאריים
├── .gitignore                          node_modules/, dist/, .cache/
├── ARCHITECTURE.md                     תיאור הארכיטקטורה
├── CODEX_ASSETS.md                     מפת נכסים מההקמה הראשונית (ראו הערה בסעיף 7)
├── PROJECT_STRUCTURE.md                המסמך הזה
├── package.json                        סקריפטים: build, typecheck, test
├── package-lock.json
├── tsconfig.json                       הגדרות TypeScript לקוד האתר
├── tsconfig.test.json                  הגדרות TypeScript לבדיקות (בלי פלט)
└── לפני-שמתחילים.txt                   הערות מההקמה הראשונית
```

**תיקיות שנוצרות אוטומטית ואינן במאגר** (מוחרגות ב־`.gitignore`):
- `node_modules/`: נוצרת ב־`npm ci`.
- `.cache/build/`: הקוד המקומפל, נוצר ב־`npm run build`.
- `dist/`: **האתר הבנוי**, וזה מה שמתפרסם. נמחקת ונבנית מחדש בכל build, ולכן אין לערוך אותה ידנית.

---

## 2. איפה נמצא מה

| מה מחפשים | איפה |
|---|---|
| **העיצוב** (צבעים, מרווחים, פריסה, מובייל) | `src/styles/site.css`. הצבעים והמרווחים מוגדרים כ־CSS custom properties בתחילת הקובץ |
| **טקסטים בדף הבית** (פתיח, כותרות סקשנים) | `src/templates/home.ts` |
| **כותרת, ניווט ו־footer** | `src/templates/layout.ts` |
| **זמני התפילות** (חול וחגים) | `src/data/prayer-times.ts`. התצוגה ב־`src/templates/prayer-times.ts` |
| **שם האתר, תיאור וכתובת הפרודקשן** | `src/data/site.ts` |
| **מודעות בלוח המודעות** | הוספה או הסרה של PDF ב־`assets/notices/` |
| **תמונות בגלריה** | הוספה או הסרה של תמונה ב־`assets/activity/`. הכיתוב נלקח משם הקובץ |
| **מודעות הפופאפ** | הוספה או הסרה של PDF ב־`assets/popup/`. ההוראות ב־`assets/popup/README.md` |
| **לוגו, שלט ו־QR** | `assets/images/` (קבצים חובה) |
| **robots.txt, sitemap.xml וקובץ Search Console** | נוצרים ב־`src/build/build.ts` |
| **הבדיקות** | `test/build-output.test.ts` |
| **מה קורה כשמסירים תמונה או PDF** | `docs/media-removal-vs-git-history.md` |

---

## 3. נקודות כניסה

| מה | פקודה | קובץ |
|---|---|---|
| בנייה | `npm run build` | `src/build/build.ts` (מקומפל ל־`.cache/build/build/build.js`) |
| בדיקת טיפוסים | `npm run typecheck` | `tsconfig.json` |
| בדיקות | `npm test` (אחרי `npm run build`) | `test/build-output.test.ts` + `tsconfig.test.json` |

**דרישות מקומיות:** Node.js 24, ו־Poppler (`pdfinfo`, `pdftoppm`) מותקן ב־PATH.

---

## 4. CI ו־Deploy

| קובץ | מתי רץ | מה עושה |
|---|---|---|
| `.github/workflows/pull-request-checks.yml` | כל Pull Request ל־`main` | `npm ci`, `typecheck`, `build`, `test`, ואז העלאת `dist/` כ־artifact. **אין פריסה** |
| `.github/workflows/deploy.yml` | push ל־`main`, או הפעלה ידנית | `npm ci`, `build` ופריסה ל־GitHub Pages |

הגנת `main` מוגדרת ב־GitHub Ruleset, בהגדרות המאגר ולא בקובץ: נדרש Pull Request, ונדרש שהבדיקה `pr-checks` עברה.

---

## 5. מוסכמות

- **שמות קבצים ופונקציות באנגלית,** ותוכן גלוי למשתמש בעברית.
- **אין רשימות קבצים ידניות** לנכסים שמתגלים אוטומטית (`notices`, `activity`, `popup`).
- **נתיבים יחסיים בלבד,** בלי נתיבים של Windows או נתיבים מקומיים מוחלטים.
- **קובצי טקסט נשמרים ב־LF** (לפי `.gitattributes`).
- **כל שינוי ב־`main` עובר דרך Pull Request** שהבדיקות שלו עברו.

---

## 6. רכיבים עתידיים 🔜 (עדיין לא קיימים)

> שום נתיב בסעיף הזה עדיין לא קיים. השמות כאן הם תכנון, והם עשויים להשתנות במימוש.

**במאגר הזה (האתר הציבורי)** צפויות רק תוספות שקשורות להצגה:

| מיקום צפוי | תפקיד |
|---|---|
| `src/client/` | קוד דפדפן נפרד: טעינת תוכן חי מה־API, קרוסלות ופופאפ יחיד |
| `src/templates/` | תבניות לקרוסלות, ושינויי עיצוב בתבניות הקיימות |
| `src/build/` | אופטימיזציית תמונות ורשימת המדיה הישנה עבור התצוגה האחידה |
| `test/` | בדיקות נוספות, כולל בדיקות דפדפן |

**במאגר פרטי נפרד** ולא כאן: ה־API, ממשק הניהול, סוכן ה־WhatsApp, סכמת מסד הנתונים והאינטגרציות עם Cloudflare R2 ו־Gemini. המבנה שלהם יתועד במאגר הפרטי.

---

## 7. הערות על קבצים היסטוריים

- **`CODEX_ASSETS.md`** נכתב בהקמה הראשונית. הוא מזכיר את `assets/activity/benizri.jpg`, אבל הקובץ הזה לא קיים במאגר. תמונות הגלריה בפועל מפורטות בסעיף 1. לגבי שאר הנכסים, המסמך תואם לתהליך הבנייה.
- **`לפני-שמתחילים.txt`** מתאר את הכנת חבילת הקבצים להקמה הראשונית. הוא לא משמש את תהליך הבנייה.
