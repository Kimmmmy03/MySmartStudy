"use client";

import { useState, useEffect } from "react";
import { badgesApi, coursesApi, type BadgeDefinition, type CourseOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import BadgeIcon, { LUCIDE_ICON_OPTIONS } from "@/components/badge-icon";
import { Award, Plus, Pencil, Trash2, Zap, Info, Upload, X, HelpCircle, Coins, Target } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

const CONDITION_TYPES = [
  { value: "maps_created", label: "Mind Maps Created", desc: "Badge is awarded when a student creates a certain number of mind maps", example: "e.g. Set threshold to 5 = student must create 5 mind maps" },
  { value: "streak_days", label: "Streak Days", desc: "Badge is awarded when a student maintains consecutive daily login streak", example: "e.g. Set threshold to 7 = student must log in 7 days in a row" },
  { value: "quiz_score", label: "Quiz/Assignment Score", desc: "Badge is awarded when a student achieves a score at or above the threshold percentage", example: "e.g. Set threshold to 90 = student must score 90% or above" },
  { value: "quizzes_completed", label: "Quizzes Completed", desc: "Badge is awarded when a student completes a certain number of quizzes", example: "e.g. Set threshold to 5 = student must complete 5 quizzes" },
  { value: "assignments_submitted", label: "Assignments Submitted", desc: "Badge is awarded when a student submits a certain number of assignments", example: "e.g. Set threshold to 10 = student must submit 10 assignments" },
  { value: "peer_reviews", label: "Peer Reviews Written", desc: "Badge is awarded when a student writes peer reviews for other students' work", example: "e.g. Set threshold to 3 = student must write 3 peer reviews" },
  { value: "early_submissions", label: "Early Submissions", desc: "Badge is awarded when a student submits work 24 hours or more before the deadline", example: "e.g. Set threshold to 3 = student must submit early 3 times" },
  { value: "course_completed", label: "Course Completed", desc: "Badge is awarded when a student completes all required activities in a course", example: "Set threshold to 1 = complete all activities in any 1 course" },
  { value: "courses_joined", label: "Courses Joined", desc: "Badge is awarded when a student enrols in a certain number of courses", example: "e.g. Set threshold to 3 = student must join 3 courses" },
  { value: "collaborations", label: "Map Collaborations", desc: "Badge is awarded when a student collaborates with others on shared mind maps", example: "e.g. Set threshold to 3 = student must collaborate on 3 maps" },
];

const COLOR_OPTIONS = [
  { value: "from-blue-500 to-cyan-400", label: "Ocean" },
  { value: "from-amber-500 to-yellow-400", label: "Gold" },
  { value: "from-orange-500 to-red-400", label: "Fire" },
  { value: "from-purple-500 to-pink-400", label: "Purple" },
  { value: "from-yellow-400 to-amber-500", label: "Amber" },
  { value: "from-sky-400 to-blue-500", label: "Sky" },
  { value: "from-pink-500 to-purple-500", label: "Pink" },
  { value: "from-emerald-500 to-teal-400", label: "Emerald" },
  { value: "from-indigo-500 to-blue-400", label: "Indigo" },
  { value: "from-rose-500 to-orange-400", label: "Rose" },
];

const CONDITION_COLORS: Record<string, string> = {
  maps_created: "border-l-accent-blue",
  streak_days: "border-l-orange-400",
  quiz_score: "border-l-accent-amber",
  quizzes_completed: "border-l-accent-pink",
  assignments_submitted: "border-l-accent-emerald",
  peer_reviews: "border-l-accent-cyan",
  early_submissions: "border-l-sky-400",
  course_completed: "border-l-indigo-400",
  courses_joined: "border-l-teal-400",
  collaborations: "border-l-violet-400",
};

export default function ManageBadgesPage() {
  const { profile } = useAuth();
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeDefinition | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formIcon, setFormIcon] = useState("trophy");
  const [formColor, setFormColor] = useState("from-blue-500 to-cyan-400");
  const [formConditionType, setFormConditionType] = useState("maps_created");
  const [formConditionValue, setFormConditionValue] = useState(1);
  const [formCourseId, setFormCourseId] = useState("");
  const [formPoints, setFormPoints] = useState(25);
  const [formLottieFile, setFormLottieFile] = useState<File | null>(null);
  const [formLottieData, setFormLottieData] = useState<ArrayBuffer | null>(null);
  const [formLottieSize, setFormLottieSize] = useState<number | null>(null);
  const [formLottieDpr, setFormLottieDpr] = useState<number | null>(null);
  const [uploadingLottie, setUploadingLottie] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [defs, courseList] = await Promise.all([
        badgesApi.definitions(),
        coursesApi.teaching(),
      ]);
      setBadges(defs);
      setCourses(courseList);
    } catch { /* empty */ }
    setLoading(false);
  };

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormIcon("trophy");
    setFormColor("from-blue-500 to-cyan-400"); setFormConditionType("maps_created");
    setFormConditionValue(1); setFormCourseId(""); setFormPoints(25);
    setFormLottieFile(null); setFormLottieData(null); setFormLottieSize(null); setFormLottieDpr(null);
  };

  const openCreate = () => { resetForm(); setEditingBadge(null); setShowCreate(true); };

  const openEdit = (badge: BadgeDefinition) => {
    setFormName(badge.name); setFormDesc(badge.description); setFormIcon(badge.icon);
    setFormColor(badge.color); setFormConditionType(badge.condition_type);
    setFormConditionValue(badge.condition_value); setFormCourseId(badge.course_id || "");
    setFormPoints(badge.points_reward); setEditingBadge(badge); setShowCreate(true);
    setFormLottieFile(null);
    setFormLottieData(null);
    setFormLottieSize(badge.lottie_size || null);
    setFormLottieDpr(badge.lottie_dpr || null);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDesc.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: formName, description: formDesc, icon: formIcon, color: formColor,
        condition_type: formConditionType, condition_value: formConditionValue,
        course_id: formCourseId || undefined, points_reward: formPoints,
        lottie_size: formLottieSize || undefined,
        lottie_dpr: formLottieDpr || undefined,
      };
      let badgeId = editingBadge?.id;
      if (editingBadge) {
        await badgesApi.updateDefinition(editingBadge.id, data);
      } else {
        const created = await badgesApi.createDefinition(data);
        badgeId = created.id;
      }
      // Upload lottie file if selected
      if (formLottieFile && badgeId) {
        setUploadingLottie(true);
        try {
          await badgesApi.uploadLottie(badgeId, formLottieFile);
        } catch { /* empty */ }
        setUploadingLottie(false);
      }
      setShowCreate(false); resetForm(); loadData();
    } catch { /* empty */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try { await badgesApi.deleteDefinition(id); loadData(); } catch { /* empty */ }
    setDeleting(null);
  };

  const defaultBadges = badges.filter(b => b.is_default);
  const customBadges = badges.filter(b => !b.is_default);
  const selectedCondition = CONDITION_TYPES.find(c => c.value === formConditionType);
  const conditionLabel = selectedCondition?.label || formConditionType;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-accent-amber" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Badges</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 btn-gradient rounded-xl text-sm font-medium text-white">
          <Plus className="w-4 h-4" /> Create Badge
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-dark-300 mb-6">
        Create badges with conditions — students earn them automatically when they meet the criteria
      </p>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-blue/5 border border-accent-blue/20 mb-6">
        <Zap className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white">Badges are awarded automatically</p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
            When a student performs an action (submits assignment, completes quiz, etc.), the system checks all badge conditions and awards matching badges instantly.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Default badges */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 dark:text-dark-300 uppercase tracking-wide mb-3">
              Built-in Badges ({defaultBadges.length})
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
              {defaultBadges.map((badge, i) => (
                <motion.div key={badge.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={clsx("glass-card p-4 flex items-center gap-4 border-l-2", CONDITION_COLORS[badge.condition_type] || "border-l-white/10")}>
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <BadgeIcon icon={badge.icon} size={badge.lottie_size || 50} animated className="text-white" lottieUrl={badge.lottie_url} lottieDpr={badge.lottie_dpr || undefined} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{badge.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{badge.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple font-medium">
                        {CONDITION_TYPES.find(c => c.value === badge.condition_type)?.label || badge.condition_type}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-dark-500 flex items-center gap-0.5">
                        <Target className="w-2.5 h-2.5" /> {badge.condition_value}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-dark-500 flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5" /> +{badge.points_reward} pts
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 dark:text-dark-400 flex-shrink-0">Built-in</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Custom badges */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 dark:text-dark-300 uppercase tracking-wide mb-3">
              Custom Badges ({customBadges.length})
            </h2>
            {customBadges.length === 0 ? (
              <div className="text-center py-12 glass-card">
                <Award className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-dark-400">No custom badges yet</p>
                <button onClick={openCreate} className="mt-3 text-xs text-accent-purple hover:text-accent-blue transition-colors">
                  Create your first badge
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                {customBadges.map((badge, i) => (
                  <motion.div key={badge.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={clsx("glass-card p-4 flex items-center gap-4 group border-l-2", CONDITION_COLORS[badge.condition_type] || "border-l-white/10")}>
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                      <BadgeIcon icon={badge.icon} size={badge.lottie_size || 50} animated className="text-white" lottieUrl={badge.lottie_url} lottieDpr={badge.lottie_dpr || undefined} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{badge.name}</h3>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEdit(badge)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 dark:text-dark-400 hover:text-accent-blue transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(badge.id)} disabled={deleting === badge.id}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 dark:text-dark-400 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{badge.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple font-medium">
                          {CONDITION_TYPES.find(c => c.value === badge.condition_type)?.label || badge.condition_type}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-dark-500 flex items-center gap-0.5">
                          <Target className="w-2.5 h-2.5" /> {badge.condition_value}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-dark-500 flex items-center gap-0.5">
                          <Coins className="w-2.5 h-2.5" /> +{badge.points_reward} pts
                        </span>
                        {badge.course_id && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-medium">
                            Course-specific
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ Create / Edit Modal — Wide landscape layout ═══════ */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={editingBadge ? "Edit Badge" : "Create New Badge"} maxWidth="max-w-6xl">
        <div className="flex gap-6">
          {/* Left: Live Preview — compact */}
          <div className="w-[200px] flex-shrink-0 flex flex-col items-center p-5 rounded-2xl bg-gray-100/50 dark:bg-dark-900/50 border border-gray-200/50 dark:border-white/5 self-start sticky top-0">
            <p className="text-[10px] font-medium text-gray-400 dark:text-dark-500 uppercase tracking-wider mb-3">Preview</p>
            <motion.div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${formColor} flex items-center justify-center shadow-lg`}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <BadgeIcon icon={formIcon} size={formLottieSize || 48} animated className="text-white" lottieUrl={editingBadge?.lottie_url} lottieData={formLottieData} lottieDpr={formLottieDpr || undefined} />
            </motion.div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mt-3 text-center">
              {formName || "Badge Name"}
            </h4>
            <p className="text-[10px] text-gray-500 dark:text-dark-400 mt-0.5 text-center leading-relaxed line-clamp-2">
              {formDesc || "Description"}
            </p>
            <div className="w-full mt-3 pt-3 border-t border-gray-200/50 dark:border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400 dark:text-dark-500">Condition</span>
                <span className="text-gray-700 dark:text-dark-200 font-medium truncate ml-1">{selectedCondition?.label?.split(" ").slice(0,2).join(" ") || formConditionType}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400 dark:text-dark-500">Threshold</span>
                <span className="text-gray-700 dark:text-dark-200 font-medium">{formConditionValue}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400 dark:text-dark-500">Points</span>
                <span className="text-accent-amber font-medium">+{formPoints}</span>
              </div>
            </div>
          </div>

          {/* Right: All fields in one page — 2-column grid */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Row 1: Name + Description side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1 block">Badge Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Super Scholar" className="glass-input w-full py-2" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1 block">Description</label>
                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  placeholder="e.g. Complete 10 quizzes" className="glass-input w-full py-2" />
              </div>
            </div>

            {/* Row 2: Icon + Color side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1.5 block">Icon</label>
                <div className="flex flex-wrap gap-1 p-1.5 rounded-xl bg-gray-50 dark:bg-dark-900/30 border border-gray-200/50 dark:border-white/5 max-h-[120px] overflow-y-auto">
                  {LUCIDE_ICON_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setFormIcon(opt.value)} title={opt.label}
                      className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                        formIcon === opt.value ? "bg-accent-purple/20 ring-2 ring-accent-purple scale-110" : "bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10")}>
                      <BadgeIcon icon={opt.value} size={16} colored />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1.5 block">Badge Color</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c.value} onClick={() => setFormColor(c.value)}
                      className={clsx("w-8 h-8 rounded-xl bg-gradient-to-br transition-all", c.value,
                        formColor === c.value ? "ring-2 ring-white dark:ring-white ring-offset-2 ring-offset-gray-100 dark:ring-offset-dark-800 scale-110" : "opacity-70 hover:opacity-100")}
                      title={c.label} />
                  ))}
                </div>

                {/* Lottie upload — compact inline */}
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1 block">
                  Lottie <span className="text-gray-400 dark:text-dark-500 font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-colors text-[11px] text-gray-600 dark:text-dark-300 cursor-pointer border border-gray-200/50 dark:border-white/10">
                    <Upload className="w-3 h-3" />
                    {formLottieFile ? formLottieFile.name : "Upload .lottie"}
                    <input type="file" accept=".lottie" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setFormLottieFile(f);
                          f.arrayBuffer().then(buf => setFormLottieData(buf));
                        }
                      }} />
                  </label>
                  {(formLottieFile || formLottieData) && (
                    <button onClick={() => { setFormLottieFile(null); setFormLottieData(null); }}
                      className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-0.5">
                      <X className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Icon size slider — horizontal compact */}
            <div className="flex items-center gap-4 p-2.5 rounded-xl bg-gray-50 dark:bg-dark-900/30 border border-gray-200/50 dark:border-white/5">
              <label className="text-xs font-medium text-gray-600 dark:text-dark-300 whitespace-nowrap">Icon Size</label>
              <input type="range" min={24} max={120} step={2}
                value={formLottieSize || 48}
                onChange={e => setFormLottieSize(parseInt(e.target.value))}
                className="flex-1 h-1.5 accent-accent-purple cursor-pointer" />
              <div className="flex items-center gap-1">
                <input type="number" min={24} max={120}
                  value={formLottieSize || 48}
                  onChange={e => setFormLottieSize(Math.max(24, Math.min(120, parseInt(e.target.value) || 48)))}
                  className="glass-input w-14 py-1 text-center text-xs font-mono" />
                <span className="text-[10px] text-gray-400 dark:text-dark-500">px</span>
              </div>
            </div>

            {/* Row 3b: Lottie DPR (resolution) slider */}
            <div className="flex items-center gap-4 p-2.5 rounded-xl bg-gray-50 dark:bg-dark-900/30 border border-gray-200/50 dark:border-white/5">
              <label className="text-xs font-medium text-gray-600 dark:text-dark-300 whitespace-nowrap">Lottie DPR</label>
              <input type="range" min={1} max={8} step={0.5}
                value={formLottieDpr || 2}
                onChange={e => setFormLottieDpr(parseFloat(e.target.value))}
                className="flex-1 h-1.5 accent-accent-cyan cursor-pointer" />
              <div className="flex items-center gap-1">
                <input type="number" min={1} max={8} step={0.5}
                  value={formLottieDpr || 2}
                  onChange={e => setFormLottieDpr(Math.max(1, Math.min(8, parseFloat(e.target.value) || 2)))}
                  className="glass-input w-14 py-1 text-center text-xs font-mono" />
                <span className="text-[10px] text-gray-400 dark:text-dark-500">&times;</span>
              </div>
            </div>

            {/* Row 4: Condition picker — 5-column clickable grid */}
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1.5 block flex items-center gap-1">
                Award Condition
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-dark-500" />
              </label>
              <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-gray-50 dark:bg-dark-900/30 border border-gray-200/50 dark:border-white/5 max-h-[110px] overflow-y-auto">
                {CONDITION_TYPES.map(c => (
                  <button key={c.value} onClick={() => setFormConditionType(c.value)}
                    className={clsx("text-left p-2 rounded-lg transition-all",
                      formConditionType === c.value
                        ? "bg-accent-purple/15 ring-1 ring-accent-purple/30"
                        : "hover:bg-white dark:hover:bg-white/5")}>
                    <p className={clsx("text-[11px] font-medium leading-tight", formConditionType === c.value ? "text-accent-purple" : "text-gray-700 dark:text-dark-200")}>
                      {c.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Condition info box */}
            {selectedCondition && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-accent-blue/5 border border-accent-blue/15">
                <Info className="w-3.5 h-3.5 text-accent-blue flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-gray-700 dark:text-dark-200">{selectedCondition.desc}</p>
                  <p className="text-[10px] text-accent-blue mt-0.5 font-medium">{selectedCondition.example}</p>
                </div>
              </div>
            )}

            {/* Row 5: Threshold + Points + Course Scope */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1 block">Threshold</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={formConditionValue}
                    onChange={e => setFormConditionValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="glass-input w-full py-2 text-center text-base font-semibold" />
                  <span className="text-[10px] text-gray-400 dark:text-dark-500 whitespace-nowrap">
                    {formConditionType === "quiz_score" ? "%" : formConditionType === "streak_days" ? "days" : "\u00d7"}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1 block">Points</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={formPoints}
                    onChange={e => setFormPoints(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full py-2 text-center text-base font-semibold" />
                  <Coins className="w-3.5 h-3.5 text-accent-amber flex-shrink-0" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-1 block">Course Scope</label>
                <select value={formCourseId} onChange={e => setFormCourseId(e.target.value)}
                  className="glass-input w-full py-2 bg-transparent dark:bg-dark-800 appearance-none cursor-pointer text-xs">
                  <option value="" className="bg-white dark:bg-dark-800">Global</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-dark-800">{c.course_code}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving || !formName.trim() || !formDesc.trim()}
                className="flex-1 btn-gradient py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40">
                {uploadingLottie ? "Uploading Lottie..." : saving ? "Saving..." : editingBadge ? "Save Changes" : "Create Badge"}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 rounded-xl text-sm text-gray-500 dark:text-dark-400 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
