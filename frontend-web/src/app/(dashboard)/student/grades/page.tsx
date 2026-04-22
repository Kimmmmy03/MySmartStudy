"use client";

import { useState, useEffect } from "react";
import { coursesApi, assignmentsApi, CourseOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import clsx from "clsx";

function gradeColor(grade: number) {
  if (grade >= 80) return "text-accent-emerald bg-accent-emerald/10 border border-accent-emerald/20";
  if (grade >= 60) return "text-accent-blue bg-accent-blue/10 border border-accent-blue/20";
  if (grade >= 50) return "text-accent-amber bg-accent-amber/10 border border-accent-amber/20";
  return "text-red-400 bg-red-500/10 border border-red-500/20";
}

function gradeLetter(grade: number) {
  if (grade >= 80) return "A";
  if (grade >= 60) return "B";
  if (grade >= 50) return "C";
  return "F";
}

export default function GradesPage() {
  const { user } = useAuth();
  const [courseGrades, setCourseGrades] = useState<{ course: CourseOut; assignments: { title: string; grade?: number | null; feedback?: string | null }[] }[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const courses = await coursesApi.enrolled();
      const results = await Promise.all(
        courses.map(async (course) => {
          const assnList = await assignmentsApi.list(course.id);
          const assignments = await Promise.all(
            assnList.map(async (a) => {
              const sub = await assignmentsApi.getMySubmission(a.id);
              return { title: a.title, grade: sub?.grade, feedback: sub?.feedback };
            })
          );
          return { course, assignments };
        })
      );
      setCourseGrades(results);
    };
    load();
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">My Grades</h1>

      {courseGrades.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No graded work yet.</p>
      ) : (
        <div className="space-y-6">
          {courseGrades.map(({ course, assignments }) => (
            <div key={course.id} className="glass-card overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 bg-white/3">
                <h3 className="font-semibold text-white">{course.course_name}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-5 py-3 text-dark-300 font-medium">Assignment</th>
                      <th className="text-center px-5 py-3 text-dark-300 font-medium">Grade</th>
                      <th className="text-left px-5 py-3 text-dark-300 font-medium">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a, i) => (
                      <tr key={i} className="border-b border-white/3">
                        <td className="px-5 py-3 text-dark-100">{a.title}</td>
                        <td className="px-5 py-3 text-center">
                          {a.grade !== undefined && a.grade !== null ? (
                            <span className={clsx("px-2.5 py-1 rounded-lg text-xs font-bold", gradeColor(a.grade))}>
                              {gradeLetter(a.grade)} ({a.grade}%)
                            </span>
                          ) : (
                            <span className="text-dark-400 text-xs">Not graded</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-dark-300 text-xs">{a.feedback || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
