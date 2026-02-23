import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button } from "../../components/ui";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const nav = useNavigate();

  const tiles = [
    { title: "Quiz Control", desc: "تشغيل/جدولة/إيقاف الكويز", to: "/admin/quiz-control" },
    { title: "Users", desc: "قبول/رفض المستخدمين", to: "/admin/users" },
    { title: "App State", desc: "فتح/غلق التسجيل والدخول والكويز", to: "/admin/app-state" },
    { title: "Leaderboard", desc: "ترتيب النتائج مباشرة", to: "/admin/leaderboard" },
    { title: "Live Stats", desc: "إحصائيات أثناء البث", to: "/admin/live-stats" },
  ];

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="نظرة عامة + اختصارات سريعة"
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Card key={t.to} className="hover:shadow-md transition">
            <CardBody className="grid gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">{t.title}</div>
                <div className="text-sm text-slate-500 mt-1">{t.desc}</div>
              </div>
              <Button variant="soft" onClick={() => nav(t.to)}>
                Open
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}