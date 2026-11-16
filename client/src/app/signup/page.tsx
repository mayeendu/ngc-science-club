"use client";

import { useT } from "@/components/i18n/language";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import toast from "@/lib/i18n/toast";
import { signUp } from "@/lib/auth-client";
import { signupSchema, type SignupValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
export default function SignupPage() {
  const t = useT();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"student" | "teacher" | "admin">("student");
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  async function onSubmit(values: SignupValues) {
    if (role !== "student") {
      toast.error("Teacher and admin access requires authorized provisioning.");
      return;
    }
    try {
      const { error } = await signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast.error(error.message || "Signup failed");
        return;
      }
      toast.success("Account created successfully!");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Unable to connect to the server");
    }
  }
  return (
    <main className="mx-auto w-full max-w-181 px-4 py-8 sm:px-8">
      <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
        {t("Join NGC Science Club")}
      </h1>
      <Card className="rounded-2xl border border-border bg-card py-0 shadow-none ring-0">
        <CardContent className="p-5 sm:p-8">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5 [&_label]:text-lg [&_label]:font-semibold [&_input]:h-14 [&_input]:rounded-xl [&_input]:border-neutral-500 [&_input]:px-4 [&_input]:text-lg"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Full name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`[${t("Full name")}]`}
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Email address")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={`[${t("Email")}]`}
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Password")}</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder={`[${t("Password")}]`}
                          autoComplete="new-password"
                          className="pr-12!"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        aria-label={
                          showPassword ? t("Hide password") : t("Show password")
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      >
                        {showPassword ? (
                          <EyeOff size={18} aria-hidden="true" />
                        ) : (
                          <Eye size={18} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Confirm password")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("Re-enter your password")}
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <label htmlFor="signup-role">{t("Role")}</label>
                <select
                  id="signup-role"
                  value={role}
                  disabled={form.formState.isSubmitting}
                  aria-describedby={
                    role !== "student" ? "signup-role-help" : undefined
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === "student" ||
                      value === "teacher" ||
                      value === "admin"
                    )
                      setRole(value);
                  }}
                  className="h-14 w-full rounded-xl border border-neutral-500 bg-background px-4 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <option value="student">{t("Student")}</option>
                  <option value="teacher">{t("Teacher")}</option>
                  <option value="admin">{t("Admin")}</option>
                </select>
                {role !== "student" && (
                  <p
                    id="signup-role-help"
                    role="status"
                    className="text-sm text-muted-foreground"
                  >
                    {t(
                      "Teacher and admin access requires authorized provisioning.",
                    )}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="h-14 rounded-xl bg-teal-700 px-7 text-lg font-semibold text-white hover:bg-teal-800"
                disabled={form.formState.isSubmitting || role !== "student"}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    {t("Creating account...")}
                  </>
                ) : (
                  t("Create account")
                )}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-slate-600">
            {t("Already have an account?")}{" "}
            <Link
              href="/login"
              className="font-medium text-blue-700 hover:underline"
            >
              {t("Sign in")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
