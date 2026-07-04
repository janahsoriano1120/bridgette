// lib/analyzeMeal.ts
// Thin client helper. Calls the analyze-food Edge Function.
// The Anthropic key lives in Supabase secrets, never here.

import { supabase } from "./supabase";

export type MealAnalysis = {
  meal: string;
  flag: "healthy" | "moderate" | "unhealthy";
  working: string[];
  noting: string[];
  swap: string;
  askDoctor: string;
};

export async function analyzeMeal(
  meal: string,
  context = ""
): Promise<MealAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { meal, context },
  });
  if (error) throw error;
  return data as MealAnalysis;
}