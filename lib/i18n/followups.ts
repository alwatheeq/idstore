export const followupCopy = {
  title: ["Customer follow-ups", "متابعات العملاء"],
  help: ["Upcoming and overdue work. Contact the customer when due; messages are not sent automatically.", "الأعمال القادمة والمتأخرة. تواصل مع العميل عند حلول الموعد؛ لا تُرسل الرسائل تلقائيًا."],
  empty: ["No open follow-ups.", "لا توجد متابعات مفتوحة."],
  error: ["Follow-ups could not be loaded. Please retry.", "تعذر تحميل المتابعات. حاول مجددًا."],
  saveError: ["Could not save the due date. Refresh and retry.", "تعذر حفظ موعد المتابعة. حدّث الصفحة وحاول مجددًا."],
  upcoming: ["Upcoming", "قادم"], today: ["Due today", "مستحق اليوم"], overdue: ["Overdue", "متأخر"], undated: ["No due date", "دون موعد متابعة"],
  high: ["High — within a week", "أولوية عالية — خلال أسبوع"], stable: ["Stable", "مستقر"], safety: ["Immediate", "فوري"],
  date: ["Follow-up due date", "تاريخ المتابعة"], call: ["Call customer", "الاتصال بالعميل"], vehicle: ["Vehicle", "المركبة"],
  edit: ["Change due date", "تعديل موعد المتابعة"], save: ["Save date", "حفظ الموعد"], saved: ["Date saved", "تم حفظ الموعد"], saving: ["Saving…", "جارٍ الحفظ…"],
  noPhone: ["No phone number recorded", "لا يوجد رقم هاتف مسجل"],
} as const;
export type FollowupTextKey = keyof typeof followupCopy;
