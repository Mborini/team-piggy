import Experience from "./Experience";

export const metadata = {
  title: "المحقق الذكي",
  description: "لعبة أسئلة تنافسية، إعداد الأستاذ حسن الساكت، أكاديمية ومدارس المجددون الدولية",
};

export default function Page() {
  return (
    <div className="conan">
      <Experience />
    </div>
  );
}