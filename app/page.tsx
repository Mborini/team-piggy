/* eslint-disable @next/next/no-img-element -- photographs are optimized local WebP assets. */
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  DEFAULT_MEMBERS,
  DESSERTS,
  MAX_POINTS,
  POINT_QIRSH,
  isGameState,
  pickDessert,
  rotationFor,
  removePoint,
  type GameState,
} from "@/lib/game";
import credits from "@/public/desserts/credits.json";
import { monthEnd, timeRemaining } from "@/lib/month-end";

type IconName =
  | "cake"
  | "wheel"
  | "users"
  | "clock"
  | "coin"
  | "arrow"
  | "plus"
  | "undo"
  | "check"
  | "close";
function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    cake: (
      <>
        <path d="M4 13h16v7H4zM3 13v-3h18v3M8 10V6m8 4V6M12 10V4M4 15q2 3 4 0 2 3 4 0 2 3 4 0 2 3 4 0" />
        <path d="M12 2v.2M8 4v.2M16 4v.2" />
      </>
    ),
    wheel: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 3v7m0 4v7M3 12h7m4 0h7M5.6 5.6l5 5m2.8 2.8 5 5m0-12.8-5 5m-2.8 2.8-5 5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2 4v2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    coin: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v2m0 8v2" />
      </>
    ),
    arrow: <path d="M19 12H5m6-6-6 6 6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    undo: (
      <>
        <path d="M4 10h10a6 6 0 1 1 0 12M4 10l5-5M4 10l5 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
const num = (n: number) => new Intl.NumberFormat("ar-JO").format(n);
const money = (points: number) => ((points * POINT_QIRSH) / 100).toFixed(2);
const date = (at: string) =>
  new Intl.DateTimeFormat("ar-JO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(new Date(at));
const INITIAL: GameState = { members: DEFAULT_MEMBERS, history: [], draws: [] };

function MonthCountdown() {
  const [clock, setClock] = useState<{
    deadline: number;
    label: string;
    now: number;
  } | null>(null);
  useEffect(() => {
    const target = monthEnd(new Date());
    const tick = () => setClock({ ...target, now: Date.now() });
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);
  const remaining = clock ? timeRemaining(clock.deadline, clock.now) : null;
  return (
    <section
      className="month-countdown"
      aria-label="العد التنازلي للمّة نهاية الشهر"
    >
      <div className="countdown-copy">
        <span className="countdown-icon">
          <Icon name="clock" size={25} />
        </span>
        <div>
          <h2>
            {remaining?.finished
              ? "حان موعد اللمّة الحلوة!"
              : "ناطرين لمّة آخر الشهر"}
          </h2>
          <p>
            {clock
              ? `نهاية ${clock.label} · بتوقيت عمّان`
              : "نهاية الشهر · بتوقيت عمّان"}
          </p>
        </div>
      </div>
      <div
        className="countdown-units"
        role="timer"
        aria-label="الوقت المتبقي حتى نهاية الشهر"
      >
        {(
          [
            ["days", "يوم"],
            ["hours", "ساعة"],
            ["minutes", "دقيقة"],
            ["seconds", "ثانية"],
          ] as const
        ).map(([key, label]) => (
          <div className="countdown-unit" key={key}>
            <strong>
              {remaining ? num(remaining[key]).padStart(2, "٠") : "—"}
            </strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Page() {
  const [game, setGame] = useState<GameState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<
    "loading" | "saved" | "saving" | "error" | "offline"
  >("loading");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(4600);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"play" | "history">("play");
  const [showCredits, setShowCredits] = useState(false);
  const [retry, setRetry] = useState(0);
  const editDialog = useRef<HTMLDialogElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinLock = useRef(false);
  const lastSaved = useRef("");
  const currentSnapshot = useRef("");
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    currentSnapshot.current = JSON.stringify(game);
  }, [game]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("load");
      const data = await response.json();
      const state = { ...data, draws: data.draws ?? [] };
      if (!isGameState(state)) throw new Error("invalid state");
      lastSaved.current = JSON.stringify(state);
      setGame(state);
      const selected = DESSERTS.findIndex(
        (d) => d.id === state.draws[0]?.dessertId,
      );
      setDuration(0);
      setRotation(selected < 0 ? 0 : rotationFor(selected, 0) % 360);
      setReady(true);
      setStatus("saved");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (spinTimer.current) clearTimeout(spinTimer.current);
    };
  }, [load]);

  useEffect(() => {
    if (!ready) return;
    const snapshot = JSON.stringify(game);
    if (snapshot === lastSaved.current) return;
    const timer = setTimeout(() => {
      setStatus("saving");
      queue.current = queue.current.then(async () => {
        // Superseded snapshots can be skipped; requests always run in order.
        if (snapshot !== currentSnapshot.current) return;
        // A request can have committed even if its response is lost. Until it
        // succeeds, an undo back to the previous state must still be saved.
        lastSaved.current = "";
        try {
          const response = await fetch("/api/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: snapshot,
          });
          if (!response.ok) throw new Error("save");
          lastSaved.current = snapshot;
          if (snapshot === currentSnapshot.current) setStatus("saved");
        } catch {
          setStatus("error");
        }
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [game, ready, retry]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        ready &&
        (currentSnapshot.current !== lastSaved.current || spinLock.current)
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [ready]);

  function addPoint(id: number) {
    setGame((previous) => {
      const player = previous.members.find((m) => m.id === id);
      if (
        !player ||
        player.points >= MAX_POINTS ||
        previous.history.length >= 599999
      )
        return previous;
      return {
        ...previous,
        members: previous.members.map((m) =>
          m.id === id ? { ...m, points: m.points + 1 } : m,
        ),
        history: [...previous.history, { memberId: id, tier: "silver" }],
      };
    });
    setNotice(
      `تمت إضافة نقطة لـ ${game.members.find((m) => m.id === id)?.name} · ٥ قروش`,
    );
  }

  function undo() {
    setGame((previous) => {
      const last = previous.history.at(-1);
      if (!last) return previous;
      return {
        ...previous,
        members: previous.members.map((m) =>
          m.id === last.memberId ? { ...m, points: m.points - 1 } : m,
        ),
        history: previous.history.slice(0, -1),
      };
    });
    setNotice("تم التراجع عن آخر نقطة");
  }

  function subtractPoint(id: number) {
    setGame((previous) => removePoint(previous, id));
    setNotice(
      `تم خصم نقطة من ${game.members.find((m) => m.id === id)?.name} · ٥ قروش`,
    );
  }

  function spin() {
    if (!ready || spinLock.current) return;
    spinLock.current = true;
    const index = pickDessert();
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 120
      : 4600;
    setDuration(ms);
    setSpinning(true);
    setRotation((previous) => rotationFor(index, previous));
    setNotice("");
    spinTimer.current = setTimeout(() => {
      const draw = {
        id: `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`,
        dessertId: DESSERTS[index].id,
        at: new Date().toISOString(),
      };
      setGame((previous) => ({
        ...previous,
        draws: [draw, ...previous.draws].slice(0, 100),
      }));
      setSpinning(false);
      spinLock.current = false;
      setNotice(
        `اختارت العجلة ${DESSERTS[index].name}؛ على اللاعبين إحضارها للجلسة!`,
      );
    }, ms);
  }

  function saveNames(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setGame((previous) => ({
      ...previous,
      members: previous.members.map((m) => ({
        ...m,
        name: String(form.get(`name-${m.id}`)).trim(),
      })),
    }));
    editDialog.current?.close();
    setNotice("تم تحديث أسماء اللاعبين");
  }

  const total = game.members.reduce((sum, m) => sum + m.points, 0);
  const ranked = [...game.members].sort(
    (a, b) => b.points - a.points || a.id - b.id,
  );
  const winner = DESSERTS.find((d) => d.id === game.draws[0]?.dessertId);
  const statusText = {
    loading: "جارٍ تحميل الجلسة",
    saved: "كل التغييرات محفوظة",
    saving: "جارٍ حفظ التغييرات",
    error: "تعذّر الحفظ، أعد المحاولة",
    offline: "تعذّر تحميل الجلسة",
  }[status];

  return (
    <div className="sweet-app">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="حلا اللمة، الرئيسية">
          <span className="brand-mark">
            <Icon name="cake" size={29} />
          </span>
          <span>
            حلا اللمّة<small>نقاطكم تحلّي جمعتكم</small>
          </span>
        </Link>
        <div className="nav-label">مساحة الفريق</div>
        <nav aria-label="القائمة الرئيسية">
          <button
            className={tab === "play" ? "nav-item active" : "nav-item"}
            onClick={() => setTab("play")}
          >
            <Icon name="wheel" /> ساحة اللعب <span>01</span>
          </button>
          <button
            className={tab === "history" ? "nav-item active" : "nav-item"}
            onClick={() => setTab("history")}
          >
            <Icon name="clock" /> سجل اللمّات{" "}
            <span>{num(game.draws.length)}</span>
          </button>
          <button
            className="nav-item"
            disabled={!ready}
            onClick={() => editDialog.current?.showModal()}
          >
            <Icon name="users" /> إدارة اللاعبين
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="small-star">✳</span>
          <h3>
            النقطة صغيرة،
            <br />
            واللمّة كبيرة.
          </h3>
          <p>
            سجّلوا النقاط، لفّوا العجلة،
            <br />
            وخَلّوا الحلو علينا… وعليكم!
          </p>
          <span className="point-pill">١ نقطة = ٥ قروش</span>
        </div>
        <div className="sidebar-footer">
          <span className="online-dot" /> صُنعت للأوقات الحلوة
          <small>TEAM PIGGY · SWEET EDITION</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            مساحة الفريق <span>/</span>{" "}
            <b>{tab === "play" ? "ساحة اللعب" : "سجل اللمّات"}</b>
          </div>
          <div className={`save-status ${status}`} role="status">
            <span />
            {statusText}
            {(status === "offline" || status === "error") && (
              <button
                onClick={() =>
                  status === "offline" ? void load() : setRetry((v) => v + 1)
                }
              >
                إعادة المحاولة
              </button>
            )}
          </div>
        </header>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> شويّة منافسة، كثير حلا
            </div>
            <h1>
              {tab === "play"
                ? "كل نقطة… بتقرّبنا للمّة أحلى."
                : "لكل لمّة، حكاية حلوة."}
            </h1>
            <p>
              {tab === "play"
                ? "نقاط لكل لاعب، وعجلة تختار شو الحلو اللي عليكم تجيبوه."
                : "اختيارات العجلة السابقة، محفوظة عشان ترجعولها بأي وقت."}
            </p>
          </div>
          <span className="session-tag">
            <Icon name="users" size={17} /> {num(game.members.length)} لاعبين ·
            لمّة واحدة
          </span>
        </section>

        <MonthCountdown />

        {tab === "play" ? (
          <>
            <section className="hero-banner">
              <img
                src={`/desserts/${winner?.id ?? "kunafa"}.webp`}
                alt={
                  winner ? `حلو اللمّة: ${winner.name}` : "كنافة ذهبية بالفستق"
                }
                className="hero-photo"
                fetchPriority="high"
              />
              <div className="hero-copy">
                <span className="hero-kicker">الحلو أحلى لما نكون مع بعض</span>
                <h2>
                  مين قال المنافسة
                  <br />
                  ما بتكون <em>حلوة؟</em>
                </h2>
                <p>
                  كل نقطة إلها قيمة، وكل لفّة إلها نكهة.
                  <br />
                  جمّعوا نقاطكم واتركوا اختيار الحلو للحظ.
                </p>
                <a href="#wheel" className="hero-link">
                  خلّينا نختار الحلو <Icon name="arrow" size={18} />
                </a>
              </div>
              <div className="hero-stamp">
                <Icon name="cake" size={24} />
                <span>
                  لمّة حلوة
                  <br />
                  <b>على أصولها</b>
                </span>
              </div>
              <span className="hero-number">01 — THE SWEET SIDE OF PLAY</span>
            </section>

            <section className="stats" aria-label="ملخص النقاط">
              <article>
                <span className="stat-icon green">
                  <Icon name="coin" />
                </span>
                <div>
                  <p>قيمة النقطة ثابتة</p>
                  <strong>
                    {num(5)} <small>قروش</small>
                  </strong>
                </div>
                <span className="stat-foot">بكل مرة، لكل لاعب</span>
              </article>
              <article>
                <span className="stat-icon caramel">
                  <Icon name="users" />
                </span>
                <div>
                  <p>مجموع نقاط الفريق</p>
                  <strong>
                    {num(total)} <small>نقطة</small>
                  </strong>
                </div>
                <span className="stat-foot">كل نقطة بتفرق</span>
              </article>
              <article>
                <span className="stat-icon rose">
                  <Icon name="coin" />
                </span>
                <div>
                  <p>إجمالي قيمة النقاط</p>
                  <strong dir="rtl">
                    <bdi>{money(total)}</bdi> <small>دينار أردني</small>
                  </strong>
                </div>
                <span className="stat-foot">٢٠ نقطة = ١ دينار</span>
              </article>
            </section>

            <div className="play-grid">
              <section className="panel wheel-panel" id="wheel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">خلّي الحظ يعزمكم</div>
                    <h2>عجلة الحلو</h2>
                  </div>
                  <span className="subtle-tag">
                    {num(DESSERTS.length)} نكهات · فرص متساوية
                  </span>
                </div>
                <div className={`wheel-stage ${spinning ? "is-spinning" : ""}`}>
                  <div className="wheel-pointer" />
                  <div
                    className="wheel-disc"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transitionDuration: `${duration}ms`,
                    }}
                  >
                    <svg
                      viewBox="0 0 440 440"
                      role="img"
                      aria-label="عجلة اختيار عشوائي تضم جميع أنواع الحلويات العشرة"
                    >
                      <circle cx="220" cy="220" r="216" fill="#e7d6b8" />
                      <circle cx="220" cy="220" r="207" fill="#553b30" />
                      {DESSERTS.map((dessert, i) => {
                        const angle = i * 36,
                          end = (i + 1) * 36;
                        const point = (a: number, r: number) => [
                          220 + r * Math.sin((a * Math.PI) / 180),
                          220 - r * Math.cos((a * Math.PI) / 180),
                        ];
                        const a = point(angle, 199),
                          b = point(end, 199),
                          label = point(angle + 18, 137);
                        return (
                          <g key={dessert.id}>
                            <path
                              d={`M220 220 L${a[0]} ${a[1]} A199 199 0 0 1 ${b[0]} ${b[1]} Z`}
                              fill={i % 2 === 0 ? "#355749" : "#eadcc5"}
                              stroke="#ffffff25"
                              strokeWidth="1"
                            />
                            <text
                              x={label[0]}
                              y={label[1]}
                              transform={`rotate(${angle + 18 - 90}, ${label[0]}, ${label[1]})`}
                              fill={i % 2 === 0 ? "#fff4df" : "#574238"}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={dessert.short.length > 9 ? 13 : 15}
                              fontWeight="600"
                            >
                              {dessert.short}
                            </text>
                            <circle
                              cx={point(angle + 18, 212)[0]}
                              cy={point(angle + 18, 212)[1]}
                              r="2.7"
                              fill="#9d7852"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="wheel-hub">
                    <Icon name="cake" size={30} />
                    <span>حلا اللمّة</span>
                  </div>
                  <span className="wheel-spark spark-one">✧</span>
                  <span className="wheel-spark spark-two">✳</span>
                </div>
                <button
                  className="spin-button"
                  onClick={spin}
                  disabled={!ready || spinning}
                >
                  <Icon name="wheel" />
                  {spinning ? "الحظ عم يختار…" : "لفّ العجلة… وشوف حظكم"}
                  <Icon name="arrow" size={19} />
                </button>
                <p className="wheel-caption">
                  النوع اللي بتختاره العجلة، على اللاعبين يجيبوه للّمة.
                </p>
                <div
                  className={`draw-result ${winner && !spinning ? "has-result" : ""}`}
                  aria-live="polite"
                >
                  {winner && !spinning ? (
                    <>
                      <img
                        src={`/desserts/${winner.id}.webp`}
                        alt={winner.name}
                      />
                      <div>
                        <small>حلو اللمّة الجاية</small>
                        <strong>{winner.name}</strong>
                      </div>
                      <span className="result-star">✦</span>
                    </>
                  ) : (
                    <>
                      <span className="result-icon">
                        <Icon name="cake" />
                      </span>
                      <div>
                        <small>
                          {spinning ? "شو بتتوقعوا يطلع؟" : "جاهزين للحلو؟"}
                        </small>
                        <strong>
                          {spinning
                            ? "ثواني وبنعرف النتيجة"
                            : "أول لفّة، وأول حكاية حلوة"}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="panel players-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">كل لاعب إله نصيب</div>
                    <h2>
                      نقاط اللاعبين{" "}
                      <span className="count-badge">
                        {num(game.members.length)}
                      </span>
                    </h2>
                  </div>
                  <button
                    className="text-button"
                    disabled={!ready}
                    onClick={() => editDialog.current?.showModal()}
                  >
                    تعديل الأسماء
                  </button>
                </div>
                <div className="players-table-head">
                  <span>اللاعب</span>
                  <span>النقاط / القيمة</span>
                  <span>تسجيل</span>
                </div>
                <div className="player-list">
                  {ranked.map((member, index) => (
                    <article className="player-row" key={member.id}>
                      <span className={`avatar avatar-${member.id}`}>
                        {member.name.slice(0, 1)}
                        <small>{num(index + 1)}</small>
                      </span>
                      <div className="player-name">
                        <h3>{member.name}</h3>
                        <span>
                          {member.points > 0 &&
                          member.points === ranked[0].points
                            ? "أعلى النقاط"
                            : "من أهل اللمّة"}
                        </span>
                      </div>
                      <div className="player-score">
                        <strong>
                          {num(member.points)} <small>نقطة</small>
                        </strong>
                        <span>
                          <bdi>{money(member.points)}</bdi> د.أ
                        </span>
                      </div>
                      <div className="score-controls">
                        <button
                          className="add-point"
                          aria-label={`أضف نقطة لـ ${member.name}`}
                          disabled={
                            !ready ||
                            member.points >= MAX_POINTS ||
                            game.history.length >= 599999
                          }
                          onClick={() => addPoint(member.id)}
                        >
                          +1
                        </button>
                        <button
                          className="add-point subtract-point"
                          aria-label={`اخصم نقطة من ${member.name}`}
                          disabled={!ready || member.points === 0}
                          onClick={() => subtractPoint(member.id)}
                        >
                          −1
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="players-bottom">
                  <span>
                    <span className="online-dot" /> كل نقطة تُحسب بـ ٥ قروش
                  </span>
                  <button
                    className="text-button"
                    disabled={!ready || !game.history.length}
                    onClick={undo}
                  >
                    <Icon name="undo" size={15} /> تراجع عن آخر نقطة
                  </button>
                </div>
                <div className="players-tip">
                  <Icon name="coin" size={20} />
                  <p>
                    زيد نقطة بـ <b>+1</b> أو انقص نقطة بـ <b>−1</b>، والقيمة
                    بتتحدّث تلقائيًا.
                  </p>
                </div>
              </section>
            </div>

            <section className="dessert-section" id="desserts">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">قائمة تستاهل اللفّة</div>
                  <h2>عشرة أسباب للَمّة حلوة</h2>
                </div>
                <span>
                  كل هالخيارات… والحظ بختار واحد{" "}
                  <span className="tiny-star">✳</span>
                </span>
              </div>
              <div className="dessert-grid">
                {DESSERTS.map((dessert, index) => (
                  <article
                    key={dessert.id}
                    className={`dessert-card ${winner?.id === dessert.id ? "selected" : ""}`}
                  >
                    <div className="dessert-image">
                      <img
                        src={`/desserts/${dessert.id}.webp`}
                        alt={dessert.name}
                        loading="lazy"
                      />
                      {dessert.id === "delight" && (
                        <img
                          className="biscuit-inset"
                          src="/desserts/biscuits.webp"
                          alt="بسكوت"
                          loading="lazy"
                        />
                      )}
                      <span className="dessert-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {winner?.id === dessert.id && (
                        <span className="selected-label">
                          <Icon name="check" size={13} /> اختيار العجلة
                        </span>
                      )}
                    </div>
                    <h3>{dessert.name}</h3>
                    <p>{dessert.note}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="panel history-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">من أول لفّة</div>
                <h2>سجل اختيارات العجلة</h2>
              </div>
              <span className="subtle-tag">آخر ١٠٠ اختيار</span>
            </div>
            {!game.draws.length ? (
              <div className="empty-state">
                <Icon name="clock" size={48} />
                <h3>لسّه الحكاية ما بلّشت</h3>
                <p>لفّوا العجلة، وأول اختيار رح تلاقوه هون.</p>
                <button
                  className="primary-button"
                  onClick={() => setTab("play")}
                >
                  يلا نلفّ العجلة
                </button>
              </div>
            ) : (
              <div className="draw-history">
                {game.draws.map((draw, i) => {
                  const dessert = DESSERTS.find(
                    (d) => d.id === draw.dessertId,
                  )!;
                  return (
                    <article key={draw.id}>
                      <img
                        src={`/desserts/${dessert.id}.webp`}
                        alt={dessert.name}
                      />
                      <div>
                        <small>
                          {i === 0
                            ? "آخر اختيار"
                            : `لمّة حلوة رقم ${num(game.draws.length - i)}`}
                        </small>
                        <h3>{dessert.name}</h3>
                        <time dateTime={draw.at}>{date(draw.at)}</time>
                      </div>
                      <span>{i === 0 ? "✦" : "✧"}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <div className="notice" role="status" aria-live="polite">
          {notice}
        </div>
        <footer className="page-footer">
          <span>
            <Icon name="cake" size={19} /> حلا اللمّة <span>·</span> المنافسة
            إلها طعم ثاني
          </span>
          <div>
            <button onClick={() => setShowCredits((v) => !v)}>
              مصادر الصور
            </button>
            <span>·</span>
            <button
              disabled={!ready || spinning}
              onClick={() => resetDialog.current?.showModal()}
            >
              بدء جلسة جديدة
            </button>
          </div>
        </footer>
        {showCredits && (
          <section className="photo-credits" aria-label="مصادر الصور">
            <h3>صور حقيقية للحلويات</h3>
            <p>
              صور توضيحية من Wikimedia Commons ومصدر المنتج. تم تصغير الصور
              وتحويلها إلى WebP.
            </p>
            {credits.map((credit) => (
              <p key={credit.id}>
                <a href={credit.source} target="_blank" rel="noreferrer">
                  {DESSERTS.find((d) => d.id === credit.id)?.name ?? "بسكوت"}
                </a>{" "}
                — {credit.author} ·{" "}
                {credit.licenseUrl ? (
                  <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
                    {credit.license}
                  </a>
                ) : (
                  credit.license
                )}
              </p>
            ))}
          </section>
        )}
      </main>

      <dialog ref={editDialog} className="sweet-dialog">
        <form onSubmit={saveNames}>
          <div className="dialog-heading">
            <h2>أهل اللمّة</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => editDialog.current?.close()}
              aria-label="إغلاق"
            >
              <Icon name="close" />
            </button>
          </div>
          <p>عدّلوا الأسماء، وخَلّوا لكل لاعب مكانه.</p>
          <div className="name-fields">
            {game.members.map((member) => (
              <label key={`${member.id}-${member.name}`}>
                اللاعب {num(member.id)}
                <input
                  name={`name-${member.id}`}
                  defaultValue={member.name}
                  maxLength={20}
                  required
                  pattern=".*\S.*"
                  autoComplete="off"
                />
              </label>
            ))}
          </div>
          <button type="submit" className="primary-button">
            حفظ الأسماء
          </button>
        </form>
      </dialog>
      <dialog ref={resetDialog} className="sweet-dialog">
        <div className="dialog-heading">
          <h2>نبدأ لمّة جديدة؟</h2>
          <button
            className="icon-button"
            onClick={() => resetDialog.current?.close()}
            aria-label="إغلاق"
          >
            <Icon name="close" />
          </button>
        </div>
        <p>
          رح تتصفّر نقاط جميع اللاعبين وينحذف سجل اختيارات العجلة. أسماء اللاعبين
          بتظل محفوظة. هالخطوة ما إلها تراجع.
        </p>
        <div className="dialog-actions">
          <button
            className="danger-button"
            onClick={() => {
              if (spinLock.current) return;
              setGame((previous) => ({
                members: previous.members.map((m) => ({ ...m, points: 0 })),
                history: [],
                draws: [],
              }));
              setRotation(0);
              resetDialog.current?.close();
              setNotice("بدأت جلسة جديدة. يلا نحلّي اللمّة!");
            }}
          >
            نعم، ابدأ جلسة جديدة
          </button>
          <button
            className="secondary-button"
            onClick={() => resetDialog.current?.close()}
          >
            نكمّل جلستنا
          </button>
        </div>
      </dialog>
    </div>
  );
}
