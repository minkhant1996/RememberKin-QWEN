# Demo Family Photo Prompts — The Nguyen Family

Prompts for generating the demo/testing photo set (Photo Room + AI Portraits).

**How to keep the same face across a person's photos:** generate ONE base portrait per
person (text-to-image), then create the scene variations with **image-edit** on that base
portrait (`POST /api/v1/images/edit`, prompt prefixed with *"Keep the same person's face and
appearance, now …"*). Group photos are text-to-image (`/images/generate`) — no face lock needed.

Base style for every portrait: `Photorealistic, warm family-album photo, soft natural window
light, gentle candid expression, 1024x1024`.

---

## Family roster (appearance anchors — keep consistent)

| Person | Persona / role | Age | Appearance anchor |
|--------|----------------|-----|-------------------|
| **Grandpa Minh** ("Ong Noi") | Family patriarch | 78 | Elderly Vietnamese man, kind weathered face, gray hair, gentle smile, brown/olive linen shirt |
| **Grandma Hoa** ("Ba Noi") | Matriarch | 74 | Elderly Vietnamese woman, silver hair, warm smile, floral blouse, jade bracelet |
| **David Miller** | Linh's husband | 50 | Vietnamese man, short black hair, friendly confident smile, navy polo shirt |
| **Linh Nguyen** | Family owner (the app user) | 45 | Vietnamese woman, shoulder-length black hair, kind eyes, cream cardigan |
| **Uncle Tuan** | Linh's brother | 51 | Vietnamese man, short black hair, easy smile, gray casual shirt |
| **Aunt Mai** | Tuan's wife | 48 | Vietnamese woman, black hair in a low bun, soft smile, light blouse |
| **An Nguyen** | Linh's teenage sibling | 17 | Vietnamese teenage boy, bright grin, gray hoodie |
| **Cousin Duc** | Tuan & Mai's son | 23 | Vietnamese young man, short neat hair, warm smile, olive t-shirt |

---

## Per-person prompts (base + 2 scene variations each)

### Grandpa Minh (Ong Noi)
- **Base portrait:** Elderly 78-year-old Vietnamese grandfather, kind weathered face, gray hair, gentle smile, olive linen shirt, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now making a colorful bamboo kite at a wooden workbench, warm afternoon light.
- **Variation 2:** Keep the same person's face and appearance, now sitting on a small wooden fishing boat at dawn by the sea, calm water.

### Grandma Hoa (Ba Noi)
- **Base portrait:** Elderly 74-year-old Vietnamese grandmother, silver hair in a bun, warm smile, floral blouse, jade bracelet, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now cooking a steaming pot of pho in a cozy home kitchen.
- **Variation 2:** Keep the same person's face and appearance, now tending bright flowers in a sunny garden, straw hat.

### David Miller
- **Base portrait:** 50-year-old Vietnamese man, short black hair, friendly confident smile, navy polo shirt, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now working at a laptop in a bright home office.
- **Variation 2:** Keep the same person's face and appearance, now grilling food at a backyard family barbecue.

### Linh Nguyen
- **Base portrait:** 45-year-old Vietnamese woman, shoulder-length black hair, kind eyes and soft smile, cream cardigan, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now reading a book in a cozy armchair by a window.
- **Variation 2:** Keep the same person's face and appearance, now having coffee at an outdoor cafe, relaxed.

### Uncle Tuan
- **Base portrait:** 51-year-old Vietnamese man, short black hair, easy warm smile, gray casual shirt, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now fixing a bicycle in a garage, sleeves rolled up.
- **Variation 2:** Keep the same person's face and appearance, now cheering at an outdoor football match with friends.

### Aunt Mai
- **Base portrait:** 48-year-old Vietnamese woman, black hair in a low bun, soft gentle smile, light blouse, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now arranging flowers at a market stall.
- **Variation 2:** Keep the same person's face and appearance, now teaching a child to write at a kitchen table.

### An Nguyen (teen)
- **Base portrait:** Cheerful 17-year-old Vietnamese teenage boy, bright grin, gray hoodie, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now studying at a desk with books and a laptop.
- **Variation 2:** Keep the same person's face and appearance, now playing an acoustic guitar in a bedroom.

### Cousin Duc
- **Base portrait:** 23-year-old Vietnamese young man, short neat hair, warm smile, olive t-shirt, head and shoulders.
- **Variation 1:** Keep the same person's face and appearance, now in a graduation gown and cap smiling outdoors.
- **Variation 2:** Keep the same person's face and appearance, now hiking on a green mountain trail with a backpack.

---

## Group / family photos (text-to-image — includes list noted)

> Group photos are generated fresh (text-to-image); faces won't match the individual
> portraits exactly. Use them as ambient "family album" shots.

### Group 1 — Family dinner
**Includes:** Grandpa Minh, Grandma Hoa, David, Linh, An (5 people, core household + grandparents)
**Prompt:** Photorealistic warm multi-generation Vietnamese family of five gathered around a dinner table sharing a home-cooked meal, cozy dining room, soft evening light, candid happy expressions.

### Group 2 — Full family reunion
**Includes:** All 8 — Grandpa Minh, Grandma Hoa, David, Linh, Uncle Tuan, Aunt Mai, An, Cousin Duc
**Prompt:** Photorealistic warm Vietnamese family reunion group photo outdoors in a garden, three generations of eight people smiling together, golden-hour light, everyone dressed casually.

### Group 3 — Lunar New Year (Tết)
**Includes:** Grandpa Minh, Grandma Hoa, Linh, An, Cousin Duc (5 people)
**Prompt:** Photorealistic Vietnamese family celebrating Lunar New Year (Tết) together at home, red and gold decorations, plates of festive food, warm candid group photo of five people.

### Group 4 — The grandparents' couple photo
**Includes:** Grandpa Minh, Grandma Hoa (2 people)
**Prompt:** Photorealistic warm portrait of an elderly Vietnamese couple sitting close together on a porch, holding hands, gentle smiles, soft afternoon light — a golden-anniversary feeling.

### Group 5 — The kids
**Includes:** An Nguyen, Cousin Duc (2 people, the younger generation)
**Prompt:** Photorealistic candid photo of two young Vietnamese men, a teenager and a young adult, laughing together outdoors, casual clothes, bright natural light.

---

## Already generated (in this folder)

**Base portraits (8/8):**
- `grandpa-minh-portrait.png`, `grandma-hoa-portrait.png` — Magnific
- `david-miller.png`, `linh-nguyen.png`, `an-nguyen.png`, `cousin-duc.png` — Qwen
- `uncle-tuan-portrait.png`, `aunt-mai-portrait.png` — Nano Banana 2 (2026-07-07)

**Scene variations (16/16 + 1 extra)** — Nano Banana 2 image-edit on each base portrait (2026-07-07):
- `grandpa-minh-kite.png`, `grandpa-minh-boat.png`
- `grandma-hoa-cooking.png`, `grandma-hoa-garden.png` (+ earlier `grandma-hoa-beach-kite.png`)
- `david-miller-office.png`, `david-miller-bbq.png`
- `linh-nguyen-reading.png`, `linh-nguyen-cafe.png`
- `uncle-tuan-bicycle.png`, `uncle-tuan-football.png`
- `aunt-mai-flowers.png`, `aunt-mai-teaching.png`
- `an-nguyen-studying.png`, `an-nguyen-guitar.png`
- `cousin-duc-graduation.png`, `cousin-duc-hiking.png`

**Group photos (5/5)** — text-to-image (2026-07-07):
- `group-1-family-dinner.png`, `group-2-family-reunion.png`, `group-3-tet.png`,
  `group-4-grandparents.png`, `group-5-the-kids.png`

✅ Set complete — 30 images. Generation log (exact prompts, per-image cost, $1.54 total):
`min-ai-content-studio-kit/projects/rememberkin-demo/output-contents/2026-07-07/`
