import Game from "./Game";

export const metadata = { title: "المحقق الذكي", description: "لعبة أسئلة تنافسية بإشراف الأستاذ حسن الساكت" };

export default function Page() {
  return (
    <div className="conan">
      <Game />
    </div>
  );
}