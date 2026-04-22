"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { mapsApi, coursesApi, MapOut, CourseOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, resolveBackendUrl } from "@/lib/utils";
import {
  Map as MapIcon, Filter, Clock, User, BookOpen,
  Grid3X3, List, SortAsc, SortDesc, Eye, Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

type SearchMode = "recent" | "code" | "course" | "email";
type ViewMode = "grid" | "list";
type SortBy = "date" | "title" | "owner";

interface StudentResult {
  id: string;
  display_name: string;
  email: string;
  photo_url: string;
}

interface RecentlyViewedMap {
  id: string;
  title: string;
  owner_email: string;
  thumbnail?: string;
  share_code?: string;
  last_modified: string;
  viewed_at: string;
}

export default function ReviewMapsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedMap[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("code");
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<MapOut[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load recently viewed maps from backend (synced across web + mobile)
  useEffect(() => {
    if (!user) return;
    mapsApi.getRecentlyViewed().then(list => {
      setRecentlyViewed(list as RecentlyViewedMap[]);
      if (list.length > 0) setSearchMode("recent");
    }).catch(() => { /* empty */ });
  }, [user]);

  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");

  // Email autocomplete
  const [studentSuggestions, setStudentSuggestions] = useState<StudentResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    if (!user) return;
    coursesApi.teaching().then(setCourses).catch(() => {});
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Auto-search helper ──
  const doSearch = useCallback(async (mode: SearchMode, term: string, courseId: string, student: StudentResult | null) => {
    let maps: MapOut[] = [];
    try {
      if (mode === "course" && courseId) {
        maps = await mapsApi.searchByCourse(courseId);
      } else if (mode === "code" && term.trim().length >= 3) {
        maps = await mapsApi.searchByCode(term.trim().toUpperCase());
      } else if (mode === "email") {
        const email = student?.email || term.trim().toLowerCase();
        if (email && email.length >= 3) maps = await mapsApi.searchByEmail(email);
      } else {
        return; // not enough input yet
      }
    } catch { /* empty */ }
    setResults(maps);
    setSearched(true);
    setLoading(false);
  }, []);

  // ── Auto-search: share code (debounced) ──
  const handleCodeInput = useCallback((value: string) => {
    const v = value.toUpperCase();
    setSearchTerm(v);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (v.trim().length < 3) { setResults([]); setSearched(false); return; }
    setLoading(true);
    searchDebounceRef.current = setTimeout(() => doSearch("code", v, "", null), 400);
  }, [doSearch]);

  // ── Auto-search: course (immediate on select) ──
  const handleCourseSelect = useCallback((courseId: string) => {
    setSelectedCourse(courseId);
    if (!courseId) { setResults([]); setSearched(false); return; }
    setLoading(true);
    doSearch("course", "", courseId, null);
  }, [doSearch]);

  // ── Auto-search: email (debounced autocomplete + auto-search on select) ──
  const handleEmailInput = useCallback((value: string) => {
    setSearchTerm(value);
    setSelectedStudent(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 1) {
      setStudentSuggestions([]);
      setShowSuggestions(false);
      setResults([]); setSearched(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const students = await mapsApi.searchStudents(value.trim());
        setStudentSuggestions(students);
        setShowSuggestions(students.length > 0);
      } catch {
        setStudentSuggestions([]);
      }
      // Also auto-search if it looks like an email
      if (value.includes("@") && value.trim().length >= 5) {
        setLoading(true);
        doSearch("email", value, "", null);
      }
    }, 400);
  }, [doSearch]);

  const selectStudent = useCallback((s: StudentResult) => {
    setSelectedStudent(s);
    setSearchTerm(s.email);
    setShowSuggestions(false);
    // Auto-search immediately
    setLoading(true);
    doSearch("email", s.email, "", s);
  }, [doSearch]);

  // Filter + sort results
  const filteredResults = results
    .filter(m => {
      if (!filterText) return true;
      const term = filterText.toLowerCase();
      return m.title.toLowerCase().includes(term) || m.owner_email.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime();
      else if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "owner") cmp = a.owner_email.localeCompare(b.owner_email);
      return sortAsc ? -cmp : cmp;
    });

  const selectedCourseName = courses.find(c => c.id === selectedCourse)?.course_name || "";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-2">Review Maps</h1>
      <p className="text-sm text-dark-300 mb-6">Browse and review student mind maps submitted via assignments</p>

      {/* Search Mode Tabs */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1 w-fit">
        {[
          { key: "recent" as SearchMode, label: "Recently Viewed", icon: Clock, count: recentlyViewed.length },
          { key: "code" as SearchMode, label: "By Share Code", icon: Hash },
          { key: "course" as SearchMode, label: "By Course", icon: BookOpen },
          { key: "email" as SearchMode, label: "By Email", icon: User },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setSearchMode(tab.key); setSearched(false); setResults([]); setSearchTerm(""); setSelectedStudent(null); setSelectedCourse(""); }}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
              searchMode === tab.key
                ? "bg-accent-purple/20 text-accent-purple"
                : "text-dark-400 hover:text-dark-200 hover:bg-white/5"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {"count" in tab && (tab.count ?? 0) > 0 && (
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search Input — no search button, auto-searches on input */}
      {searchMode !== "recent" && <div className="mb-6 max-w-xl">
        {searchMode === "course" ? (
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none z-10" />
            <select
              value={selectedCourse}
              onChange={e => handleCourseSelect(e.target.value)}
              className="glass-input w-full pl-10 pr-4 py-2.5 text-sm appearance-none bg-dark-800 text-white rounded-xl border border-white/10 focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/20 transition-all cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              <option value="" className="bg-dark-800 text-dark-400">Select a course...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id} className="bg-dark-800 text-white">{c.course_name} ({c.course_code})</option>
              ))}
            </select>
          </div>
        ) : searchMode === "email" ? (
          <div className="relative" ref={suggestionsRef}>
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 z-10" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleEmailInput(e.target.value)}
              onFocus={() => { if (studentSuggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Type student name or email..."
              className="glass-input w-full pl-10 py-2.5"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
              </div>
            )}
            <AnimatePresence>
              {showSuggestions && studentSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 glass-card border border-white/10 rounded-xl overflow-hidden z-50 max-h-[240px] overflow-y-auto"
                >
                  {studentSuggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      {s.photo_url ? (
                        <img src={resolveBackendUrl(s.photo_url)} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-accent-purple/20 flex items-center justify-center text-xs font-bold text-accent-purple flex-shrink-0">
                          {(s.display_name || s.email)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{s.display_name || "No Name"}</p>
                        <p className="text-[10px] text-dark-400 truncate">{s.email}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 z-10" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleCodeInput(e.target.value)}
              placeholder="Enter share code..."
              className="glass-input w-full pl-10 py-2.5 font-mono uppercase"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>}

      {/* Recently Viewed */}
      {searchMode === "recent" && (
        recentlyViewed.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-16 h-16 text-dark-500 mx-auto mb-4" />
            <p className="text-dark-300">No recently viewed maps</p>
            <p className="text-xs text-dark-500 mt-2">Maps you review will appear here</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-sm text-dark-300">
                {recentlyViewed.length} recently viewed map{recentlyViewed.length !== 1 ? "s" : ""}
              </p>
              <div className="flex bg-white/5 rounded-lg overflow-hidden">
                <button onClick={() => setViewMode("grid")}
                  className={clsx("p-1.5", viewMode === "grid" ? "bg-accent-purple/20 text-accent-purple" : "text-dark-400")}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode("list")}
                  className={clsx("p-1.5", viewMode === "list" ? "bg-accent-purple/20 text-accent-purple" : "text-dark-400")}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                <AnimatePresence mode="popLayout">
                  {recentlyViewed.map((map, i) => (
                    <motion.div key={map.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: 0.03 * i }}
                      onClick={() => router.push(`/lecturer/view-map/${map.id}`)}
                      className="glass-card overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-accent-purple/40 transition-all group">
                      <div className="h-[140px] bg-dark-800 flex items-center justify-center overflow-hidden relative">
                        {map.thumbnail ? <img src={map.thumbnail} alt={map.title} className="w-full h-full object-cover" />
                          : <MapIcon className="w-12 h-12 text-dark-600" />}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="p-3 space-y-1">
                        <h4 className="font-medium text-white text-sm truncate">{map.title}</h4>
                        <div className="flex items-center gap-1 text-xs text-dark-400"><User className="w-3 h-3" /><span className="truncate">{map.owner_email}</span></div>
                        <div className="flex items-center gap-1 text-xs text-dark-500"><Clock className="w-3 h-3" />Viewed {formatDate(map.viewed_at)}</div>
                        {map.share_code && <span className="inline-block text-[10px] font-mono bg-accent-cyan/10 text-accent-cyan px-1.5 py-0.5 rounded">{map.share_code}</span>}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {recentlyViewed.map((map, i) => (
                    <motion.div key={map.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }} transition={{ delay: 0.02 * i }}
                      onClick={() => router.push(`/lecturer/view-map/${map.id}`)}
                      className="glass-card flex items-center gap-4 p-3 cursor-pointer hover:border-accent-purple/30 transition-all group">
                      <div className="w-20 h-14 rounded-lg bg-dark-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {map.thumbnail ? <img src={map.thumbnail} alt={map.title} className="w-full h-full object-cover" />
                          : <MapIcon className="w-6 h-6 text-dark-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white text-sm truncate">{map.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-dark-400 mt-0.5">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{map.owner_email}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Viewed {formatDate(map.viewed_at)}</span>
                        </div>
                      </div>
                      {map.share_code && <span className="text-[10px] font-mono bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded flex-shrink-0">{map.share_code}</span>}
                      <Eye className="w-4 h-4 text-dark-500 group-hover:text-accent-purple transition-colors flex-shrink-0" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )
      )}

      {/* Results header */}
      {searchMode !== "recent" && searched && results.length > 0 && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm text-dark-300">
            {filteredResults.length} map{filteredResults.length !== 1 ? "s" : ""} found
            {selectedCourseName && <span className="text-accent-purple"> in {selectedCourseName}</span>}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400" />
              <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
                placeholder="Filter results..." className="glass-input pl-8 pr-3 py-1.5 text-xs w-40" />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
              className="glass-input px-2 py-1.5 text-xs appearance-none bg-dark-800 rounded-lg border border-white/10 pr-6 cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}>
              <option value="date" className="bg-dark-800">Date</option>
              <option value="title" className="bg-dark-800">Title</option>
              <option value="owner" className="bg-dark-800">Owner</option>
            </select>
            <button onClick={() => setSortAsc(!sortAsc)} className="p-1.5 rounded-lg hover:bg-white/5 text-dark-400 hover:text-dark-200">
              {sortAsc ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>
            <div className="flex bg-white/5 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode("grid")}
                className={clsx("p-1.5", viewMode === "grid" ? "bg-accent-purple/20 text-accent-purple" : "text-dark-400")}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")}
                className={clsx("p-1.5", viewMode === "list" ? "bg-accent-purple/20 text-accent-purple" : "text-dark-400")}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {searchMode === "recent" ? null : loading && !searched ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
        </div>
      ) : searched && filteredResults.length === 0 ? (
        <div className="text-center py-16">
          <MapIcon className="w-16 h-16 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-300">{results.length === 0 ? "No maps found" : `No maps match "${filterText}"`}</p>
          {searchMode === "course" && results.length === 0 && (
            <p className="text-xs text-dark-500 mt-2">No mind maps have been submitted for assignments in this course yet</p>
          )}
        </div>
      ) : !searched ? (
        <div className="text-center py-16">
          <MapIcon className="w-16 h-16 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-300">
            {searchMode === "code" ? "Start typing a share code to search..." :
             searchMode === "course" ? "Select a course to see submitted maps" :
             "Type a student name or email to search..."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          <AnimatePresence mode="popLayout">
            {filteredResults.map((map, i) => (
              <motion.div key={map.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: 0.03 * i }}
                onClick={() => router.push(`/lecturer/view-map/${map.id}`)}
                className="glass-card overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-accent-purple/40 transition-all group">
                <div className="h-[140px] bg-dark-800 flex items-center justify-center overflow-hidden relative">
                  {map.thumbnail ? <img src={map.thumbnail} alt={map.title} className="w-full h-full object-cover" />
                    : <MapIcon className="w-12 h-12 text-dark-600" />}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <h4 className="font-medium text-white text-sm truncate">{map.title}</h4>
                  <div className="flex items-center gap-1 text-xs text-dark-400"><User className="w-3 h-3" /><span className="truncate">{map.owner_email}</span></div>
                  <div className="flex items-center gap-1 text-xs text-dark-500"><Clock className="w-3 h-3" />{formatDate(map.last_modified)}</div>
                  {map.share_code && <span className="inline-block text-[10px] font-mono bg-accent-cyan/10 text-accent-cyan px-1.5 py-0.5 rounded">{map.share_code}</span>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredResults.map((map, i) => (
              <motion.div key={map.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }} transition={{ delay: 0.02 * i }}
                onClick={() => router.push(`/lecturer/view-map/${map.id}`)}
                className="glass-card flex items-center gap-4 p-3 cursor-pointer hover:border-accent-purple/30 transition-all group">
                <div className="w-20 h-14 rounded-lg bg-dark-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {map.thumbnail ? <img src={map.thumbnail} alt={map.title} className="w-full h-full object-cover" />
                    : <MapIcon className="w-6 h-6 text-dark-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white text-sm truncate">{map.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-dark-400 mt-0.5">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{map.owner_email}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(map.last_modified)}</span>
                  </div>
                </div>
                {map.share_code && <span className="text-[10px] font-mono bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded flex-shrink-0">{map.share_code}</span>}
                <Eye className="w-4 h-4 text-dark-500 group-hover:text-accent-purple transition-colors flex-shrink-0" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
