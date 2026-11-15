import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const folder = new URL("../public/desserts/", import.meta.url);
await mkdir(folder, { recursive: true });
const subjects = [
  ["chocolate", "Chocolate cake"],
  ["kunafa", "Knafeh"],
  ["harissa", "Basbousa"],
  ["turkish", "Trileçe"],
  ["baklava", "Baklava"],
  ["awama", "Lokma"],
  ["om-ali", "Om Ali"],
  ["delight", "Turkish delight"],
  ["biscuits", "Biscuit"],
];
const credits = [];
async function json(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1800 + attempt * 2000));
    const response = await fetch(url);
    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      if (attempt === 5) throw new Error(body.slice(0, 200));
    }
  }
}
async function commons(file) {
  const params = new URLSearchParams({
    action: "query",
    titles: file,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1000",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
    format: "json",
  });
  const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`);
  return Object.values(data.query.pages)[0].imageinfo[0];
}
async function save(id, info) {
  const response = await fetch(info.thumburl || info.url);
  if (!response.ok) throw new Error(`${id}: ${response.status}`);
  const image = await sharp(Buffer.from(await response.arrayBuffer()))
    .rotate()
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  await writeFile(new URL(`${id}.webp`, folder), image);
  credits.push({
    id,
    source: info.descriptionurl,
    author: (info.extmetadata?.Artist?.value || "").replace(/<[^>]*>/g, ""),
    license: info.extmetadata?.LicenseShortName?.value || "",
    licenseUrl: info.extmetadata?.LicenseUrl?.value || "",
  });
  await writeFile(
    new URL("credits.json", folder),
    JSON.stringify(credits, null, 2),
  );
  console.log(`${id}: ${Math.round(image.length / 1024)} KB`);
}
for (const [id, title] of subjects) {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "pageimages",
    piprop: "name",
    format: "json",
  });
  const data = await json(`https://en.wikipedia.org/w/api.php?${params}`);
  const file = Object.values(data.query.pages)[0].pageimage;
  if (!file) throw new Error(`Missing image: ${title}`);
  await save(id, await commons(`File:${file}`));
}
await save("cheese", await commons("File:Halawet el Jibn with attar.jpg"));
await save("beyn", {
  url: "https://alsultanoglu.com/cdn/shop/files/Artboard_7_720x.png?v=1740792703",
  descriptionurl: "https://alsultanoglu.com/products/bin-narin",
  extmetadata: {
    Artist: { value: "AL SULTAN OGLU SWEETS" },
    LicenseShortName: { value: "صورة المنتج — المصدر الأصلي" },
  },
});
await writeFile(
  new URL("credits.json", folder),
  JSON.stringify(credits, null, 2),
);
