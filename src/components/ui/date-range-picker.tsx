"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"

interface DateRangePickerProps {
    startDate: Date
    endDate: Date
    onStartDateChange: (date: Date) => void
    onEndDateChange: (date: Date) => void
    label?: string
    className?: string
}

export function DateRangePicker({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    className,
}: DateRangePickerProps) {
    return (
        <div className={cn("flex flex-wrap items-end gap-4", className)}>
            <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">
                    Start Date
                </Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[160px] justify-start text-left font-mono text-xs h-11 bg-black/20 border-white/10 text-white hover:bg-white/5 hover:text-white transition-all",
                                !startDate && "text-zinc-500"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {startDate ? format(startDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-black/95 border-white/10 backdrop-blur-3xl" align="start">
                        <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => date && onStartDateChange(date)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">
                    End Date
                </Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[160px] justify-start text-left font-mono text-xs h-11 bg-black/20 border-white/10 text-white hover:bg-white/5 hover:text-white transition-all",
                                !endDate && "text-zinc-500"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {endDate ? format(endDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-black/95 border-white/10 backdrop-blur-3xl" align="start">
                        <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => date && onEndDateChange(date)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    )
}
