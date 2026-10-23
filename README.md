# DnD Table

เว็บสำหรับเล่น D&D กันเองในกลุ่ม เปิดคู่กับ Discord ได้เลย ไม่ต้องมีเซิร์ฟเวอร์ ขึ้น GitHub Pages ได้

- **ตัวละคร** — ฟอร์มสร้างตัวละคร คำนวณโมดิฟายเออร์ / โบนัสชำนาญ / HP / AC อัตโนมัติ กดทอยเช็ค เซฟ ทักษะ อาวุธได้จากชีทเลย มีปุ่มสุ่มสถานะ (4d6 ตัดต่ำสุด) แล้วจัดตามอาชีพให้ ส่งออก/นำเข้า JSON ได้
- **กระดาน** — กริด 40×40 ซูมและเลื่อนได้ (เมาส์ + ทัช) วางโทเคน ลากแล้ว snap เข้าช่อง โชว์ระยะเป็น ft ตั้งรูปแผนที่พื้นหลังได้ (DM)
- **ลูกเต๋า** — แตะ d4–d100 ทอยทันที ตั้งจำนวน / โบนัสได้ ได้เปรียบ–เสียเปรียบ พิมพ์สูตรเองได้ (เช่น `8d6+4`) ประวัติการทอยซิงก์ทั้งห้อง
- **ห้องออนไลน์** — ใช้ Firebase Realtime Database + Anonymous Auth ถ้ายังไม่ตั้งค่า แอปจะทำงานแบบออฟไลน์

## ตั้งค่า Firebase (ทำครั้งเดียว)

1. [Firebase Console](https://console.firebase.google.com) → สร้างโปรเจกต์ (หรือใช้โปรเจกต์เดิมก็ได้)
2. **Build → Authentication → Sign-in method** → เปิด **Anonymous**
3. **Build → Realtime Database** → Create database
4. แท็บ **Rules** → ใส่กฎด้านล่างแล้ว Publish
   - ถ้าโปรเจกต์/ฐานข้อมูลนี้มีกฎของแอปอื่นอยู่แล้ว ให้เพิ่มเฉพาะก้อน `"rooms": { ... }` เข้าไปใน `"rules"` อย่าเขียนทับของเดิม
5. **Project settings → Your apps → Web (`</>`)** → คัดลอก config มาใส่ใน `firebase-config.js` (ต้องมี `databaseURL` ด้วย)

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": "auth != null",
        "meta": {
          ".write": "auth != null && (data.exists() ? data.child('dm').val() === auth.uid : newData.child('dm').val() === auth.uid)",
          ".validate": "newData.hasChild('dm')"
        },
        "tokens": {
          "$tid": {
            ".write": "auth != null && (root.child('rooms').child($room).child('meta/dm').val() === auth.uid || (data.exists() ? data.child('owner').val() === auth.uid : newData.child('owner').val() === auth.uid))",
            ".validate": "newData.hasChildren(['name','x','y','size','color','owner']) && newData.child('name').isString() && newData.child('name').val().length <= 40 && newData.child('x').isNumber() && newData.child('x').val() >= 0 && newData.child('x').val() < 40 && newData.child('y').isNumber() && newData.child('y').val() >= 0 && newData.child('y').val() < 40 && newData.child('size').isNumber() && newData.child('size').val() >= 1 && newData.child('size').val() <= 4"
          }
        },
        "rolls": {
          "$rid": {
            ".write": "auth != null && !data.exists()",
            ".validate": "newData.hasChildren(['who','total','ts'])"
          }
        },
        "chars": {
          "$uid": { ".write": "auth != null && $uid === auth.uid" }
        }
      }
    }
  }
}
```

**สิทธิ์ตามกฎนี้:** ใครมีรหัสห้องก็อ่านห้องได้ · ผู้เล่นย้าย/แก้/ลบได้เฉพาะโทเคนของตัวเอง · DM (คนสร้างห้อง) จัดการได้ทุกโทเคนและตั้งพื้นหลัง · ทุกคนทอยลูกเต๋าได้แต่แก้ประวัติเก่าไม่ได้ เหมาะกับกลุ่มเพื่อน ไม่ได้ออกแบบให้ทนคนประสงค์ร้าย

## ขึ้น GitHub Pages

1. สร้าง repo แล้วอัปโหลดไฟล์ทั้งหมด (`index.html`, `style.css`, `script.js`, `dice.js`, `firebase-config.js`)
2. **Settings → Pages** → Source: `Deploy from a branch` → `main` / `(root)`
3. เปิด `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`
4. ถ้า Auth ฟ้อง `unauthorized-domain` → Firebase Console → Authentication → Settings → Authorized domains → เพิ่ม `<ชื่อผู้ใช้>.github.io`

> `apiKey` ของ Firebase เป็นค่าสาธารณะ ใส่ใน repo ได้ ความปลอดภัยอยู่ที่ Rules ด้านบน

## วิธีเล่น

1. DM กดปุ่มมุมขวาบน → ใส่ชื่อ → **สร้างห้อง** → **คัดลอกลิงก์ห้อง** ส่งเข้า Discord
2. ผู้เล่นเปิดลิงก์ ใส่ชื่อ → เข้าห้องอัตโนมัติ
3. ผู้เล่นสร้างตัวละครในแท็บ "ตัวละคร" → แท็บ "กระดาน" กด **ตัวฉัน** เพื่อวางโทเคน
4. ทอยจากชีทหรือแท็บลูกเต๋า ผลขึ้นให้ทั้งห้องเห็น

## ข้อควรรู้

- ตัวตน DM ผูกกับเบราว์เซอร์ที่สร้างห้อง (Anonymous Auth) ถ้าล้างข้อมูลเบราว์เซอร์จะเสียสิทธิ์ DM ของห้องนั้น → สร้างห้องใหม่
- ตัวละครเก็บในเบราว์เซอร์ (localStorage) ควรกด **ส่งออก** สำรองไว้เป็นครั้งคราว
- ปุ่ม ได้เปรียบ/เสียเปรียบ ใช้กับการทอย d20 ครั้งถัดไปแล้วรีเซ็ตเป็นปกติเอง
- ถ้าจะลองบนเครื่อง ต้องเปิดผ่านเซิร์ฟเวอร์ (เช่น `npx serve` หรือ `python -m http.server`) เพราะใช้ ES modules เปิดไฟล์ตรงๆ จะไม่ทำงาน
