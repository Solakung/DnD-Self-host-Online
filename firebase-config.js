// วางค่า config จาก Firebase Console → Project settings → Your apps → Web app
// ถ้ายังไม่ได้ใส่ แอปจะทำงานแบบออฟไลน์ (ตัวละคร/กระดาน/ลูกเต๋าใช้ได้หมด แต่ไม่ซิงก์กับเพื่อน)
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "YOUR-PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR-PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR-PROJECT",
  appId: "PASTE_APP_ID",
};
