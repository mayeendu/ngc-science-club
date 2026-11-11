"use client";
import { useT } from "@/components/i18n/language";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  quizFormSchema,
  saveQuiz,
  blankQuestion,
  type QuizValues,
  type QuizDetail,
} from "@/lib/quiz-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
export function QuizEditor({
  quiz,
  saved,
  cancel,
  failed,
}: {
  quiz: QuizDetail | null;
  saved: () => void;
  cancel: () => void;
  failed: (cause: unknown) => void;
}) {
  const t = useT();
  const form = useForm<QuizValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: quiz
      ? {
          title: quiz.title,
          description: quiz.description,
          subject: quiz.subject,
          durationMinutes: quiz.durationMinutes,
          questions: quiz.questions,
        }
      : {
          title: "",
          description: "",
          subject: "",
          durationMinutes: 30,
          questions: [blankQuestion()],
        },
  });
  const array = useFieldArray({ control: form.control, name: "questions" });
  const questions = useWatch({ control: form.control, name: "questions" });
  const totalMarks = (questions ?? []).reduce(
    (sum, question) =>
      sum + (Number.isFinite(question.marks) ? question.marks : 0),
    0,
  );
  async function submit(values: QuizValues) {
    try {
      await saveQuiz(values, quiz);
      saved();
    } catch (cause) {
      failed(cause);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl">
            {quiz ? t("Edit draft quiz") : t("Create science quiz")}
          </h2>
        </CardTitle>
        <p className="text-sm text-slate-600">
          {t(
            "Save as a draft, then publish from the quiz list. Total marks are calculated from the questions.",
          )}
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(submit)}
            noValidate
            className="space-y-6"
          >
            <fieldset
              disabled={form.formState.isSubmitting}
              className="space-y-5"
            >
              <legend className="sr-only">{t("Quiz content")}</legend>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Quiz title")}</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={150} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Description")}</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={3}
                        maxLength={2000}
                        className="w-full rounded-md border bg-white p-3 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Subject")}</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Duration (minutes)")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={180}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <label
                    htmlFor="quiz-total"
                    className="mb-2 block text-sm font-medium"
                  >
                    {t("Total marks (calculated)")}
                  </label>
                  <Input id="quiz-total" value={totalMarks} readOnly />
                </div>
              </div>
              <div className="space-y-5">
                {array.fields.map((item, index) => (
                  <fieldset
                    key={item.id}
                    className="space-y-4 rounded-xl border p-4"
                  >
                    <legend className="px-2 font-semibold">
                      {t("Question {0}", [index + 1])}
                    </legend>
                    <FormField
                      control={form.control}
                      name={`questions.${index}.text`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("Question {0} text", [index + 1])}
                          </FormLabel>
                          <FormControl>
                            <textarea
                              {...field}
                              rows={2}
                              maxLength={1000}
                              className="w-full rounded-md border p-3 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      {([0, 1, 2, 3] as const).map((option) => (
                        <FormField
                          key={option}
                          control={form.control}
                          name={`questions.${index}.options.${option}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("Question {0} option {1}", [
                                  index + 1,
                                  option + 1,
                                ])}
                              </FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={300} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`questions.${index}.correctOption`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("Question {0} correct answer", [index + 1])}
                            </FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                onChange={(event) =>
                                  field.onChange(Number(event.target.value))
                                }
                                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                              >
                                {[0, 1, 2, 3].map((value) => (
                                  <option key={value} value={value}>
                                    {t("Option {0}", [value + 1])}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`questions.${index}.marks`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("Question {0} marks", [index + 1])}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min={1}
                                max={100}
                                onChange={(event) =>
                                  field.onChange(Number(event.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`questions.${index}.explanation`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t(
                              "Question {0} explanation (released results only)",
                              [index + 1],
                            )}
                          </FormLabel>
                          <FormControl>
                            <textarea
                              {...field}
                              value={field.value ?? ""}
                              rows={3}
                              maxLength={2000}
                              className="w-full rounded-md border p-3 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.formState.errors.questions?.[index]?.options
                      ?.message && (
                      <p role="alert" className="text-sm text-red-700">
                        {t(
                          form.formState.errors.questions[index]?.options
                            ?.message,
                        )}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => array.remove(index)}
                    >
                      {t("Remove question {0}", [index + 1])}
                    </Button>
                  </fieldset>
                ))}
              </div>
              {array.fields.length === 0 && (
                <p className="text-sm text-slate-600">
                  {t(
                    "Draft has no questions. Add at least one complete MCQ before publishing.",
                  )}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={array.fields.length >= 50}
                onClick={() => array.append(blankQuestion())}
              >
                {t("Add question")}
              </Button>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("Saving quiz\u2026")
                  : t("Save draft")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={form.formState.isSubmitting}
                onClick={cancel}
              >
                {t("Cancel editing")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
