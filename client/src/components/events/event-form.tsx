"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  eventContentSchema,
  eventCategories,
  saveEvent,
  type ClubEvent,
} from "@/lib/event-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import toast from "react-hot-toast";
const formSchema = eventContentSchema.omit({ startsAt: true }).extend({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        Number.isFinite(+date) && date.toISOString().slice(0, 10) === value
      );
    }, "Select a valid date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Select a time"),
});
type Values = z.infer<typeof formSchema>;
export function EventForm({
  event,
  onSaved,
  onCancel,
}: {
  event?: ClubEvent;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const local = event
    ? new Date(Date.parse(event.startsAt) + 6 * 3600000).toISOString()
    : "";
  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: event
      ? {
          title: event.title,
          description: event.description,
          category: event.category,
          venue: event.venue,
          capacity: event.capacity,
          image: event.image,
          date: local.slice(0, 10),
          time: local.slice(11, 16),
        }
      : {
          title: "",
          description: "",
          category: "workshop",
          venue: "",
          capacity: 50,
          image: "",
          date: "",
          time: "",
        },
  });
  async function submit(values: Values) {
    const { date, time, ...content } = values;
    try {
      await saveEvent(
        {
          ...content,
          startsAt: new Date(`${date}T${time}:00+06:00`).toISOString(),
        },
        event,
      );
      toast.success(event ? "Event draft updated." : "Event draft created.");
      onSaved();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to save event.",
      );
    }
  }
  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="mb-5 text-2xl font-bold">
        {event ? "Edit event draft" : "Create event or activity"}
      </h2>
      <Form {...form}>
        <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
          <fieldset
            disabled={form.formState.isSubmitting}
            className="space-y-5"
          >
            <legend className="sr-only">Event details</legend>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={5}
                      maxLength={5000}
                      className="w-full rounded-md border p-3"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <select {...field} className="w-full rounded-md border p-3">
                      {eventCategories.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date (Dhaka)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time (Dhaka)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="venue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={200} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity (1–1000)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      max={1000}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (optional HTTPS)</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" maxLength={2048} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm text-slate-600">
              All times use Asia/Dhaka (UTC+06:00). Achievements can be dated in
              the past and do not accept registrations. Other event dates must
              be in the future.
            </p>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save draft"}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={form.formState.isSubmitting}
              onClick={onCancel}
            >
              Cancel editing
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
