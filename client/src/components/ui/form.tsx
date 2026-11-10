"use client";

import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;
const FieldContext = React.createContext<{ name: string } | null>(null);
const ItemContext = React.createContext<{ id: string } | null>(null);

function FormField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues> = FieldPath<TValues>,
>(props: ControllerProps<TValues, TName>) {
  return (
    <FieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FieldContext.Provider>
  );
}

function useFormField() {
  const field = React.useContext(FieldContext);
  const item = React.useContext(ItemContext);
  const { control, getFieldState } = useFormContext();
  const formState = useFormState({ control, name: field?.name });
  if (!field || !item) {
    throw new Error(
      "Form helpers must be nested inside FormField and FormItem.",
    );
  }
  return {
    ...getFieldState(field.name, formState),
    inputId: `${item.id}-input`,
    messageId: `${item.id}-message`,
  };
}

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();
  return (
    <ItemContext.Provider value={{ id }}>
      <div className={cn("space-y-2", className)} {...props} />
    </ItemContext.Provider>
  );
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  const { error, inputId } = useFormField();
  return (
    <Label
      {...props}
      htmlFor={inputId}
      className={cn(error && "text-destructive", className)}
    />
  );
}

function FormControl({
  children,
}: {
  children: React.ReactElement<React.ComponentProps<"input">>;
}) {
  const { error, inputId, messageId } = useFormField();
  // The child must be the input itself, not a surrounding layout element.
  return React.cloneElement(children, {
    id: inputId,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? messageId : undefined,
  });
}

function FormMessage({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  const { error, messageId } = useFormField();
  const message = error?.message ? String(error.message) : children;
  if (!message) return null;
  return (
    <p
      {...props}
      id={messageId}
      role="alert"
      className={cn("text-sm text-destructive", className)}
    >
      {message}
    </p>
  );
}

export { Form, FormControl, FormField, FormItem, FormLabel, FormMessage };
