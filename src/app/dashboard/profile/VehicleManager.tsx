'use client';

import * as React from 'react';
import { Car, Plus, X } from 'lucide-react';
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UseFormReturn } from 'react-hook-form';

interface Vehicle {
    type: 'car' | 'bike' | 'tempo' | 'other' | 'walking';
    number: string;
}

interface VehicleManagerProps {
    form: UseFormReturn<any>;
    vehicleFields: (Vehicle & { id: string })[];
    appendVehicle: (vehicle: Vehicle) => void;
    removeVehicle: (index: number) => void;
}

export function VehicleManager({
    form,
    vehicleFields,
    appendVehicle,
    removeVehicle,
}: VehicleManagerProps) {
    const { toast } = useToast();
    const [newVehicleNumber, setNewVehicleNumber] = React.useState('');
    const [newVehicleType, setNewVehicleType] = React.useState<'car' | 'bike' | 'tempo' | 'other' | 'walking'>('car');

    React.useEffect(() => {
        if (newVehicleType === 'walking') {
            setNewVehicleNumber('WALKING');
        } else {
            if (newVehicleNumber === 'WALKING') {
                setNewVehicleNumber('');
            }
        }
    }, [newVehicleType, newVehicleNumber]);

    const handleAddVehicle = () => {
        if (newVehicleNumber.trim() === '') {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Vehicle number cannot be empty.' });
            return;
        }
        const currentVehicles = form.getValues('vehicles') || [];
        if (currentVehicles.find((v: Vehicle) => v.number.toLowerCase() === newVehicleNumber.trim().toLowerCase())) {
            toast({ variant: 'destructive', title: 'Duplicate Vehicle', description: 'This vehicle number is already in your list.' });
            return;
        }
        appendVehicle({ type: newVehicleType, number: newVehicleNumber.trim().toUpperCase() });
        setNewVehicleNumber('');
    };

    const handleRemoveVehicle = (index: number) => {
        const vehicleToRemove = (form.getValues('vehicles') || [])[index];
        if (vehicleToRemove && form.getValues('selected_vehicle_number') === vehicleToRemove.number) {
            form.setValue('selected_vehicle_number', null);
        }
        removeVehicle(index);
    };

    return (
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6">
            <FormField control={form.control} name="vehicles" render={() => (
                <FormItem>
                    <FormLabel className="flex items-center gap-3 text-zinc-300 font-headline font-bold uppercase tracking-widest text-[10px]">
                        <Car className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                        <span>Vehicle Management</span>
                    </FormLabel>
                    <FormDescription className="text-zinc-500 text-[10px]">Add your vehicles for faster entry at gates.</FormDescription>
                    <div className="space-y-3 pt-4">
                        <FormField control={form.control} name="selected_vehicle_number" render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value ?? ''} className="space-y-3">
                                {vehicleFields.map((vehicle, index) => (
                                    <div key={vehicle.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-4 hover:border-white/10 transition-all group/vehicle">
                                        <div className="flex items-center gap-4">
                                            <RadioGroupItem value={vehicle.number} id={`vehicle-${index}`} className="border-white/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                                            <Label htmlFor={`vehicle-${index}`} className="flex items-center gap-3 font-normal cursor-pointer">
                                                <Badge variant="outline" className="capitalize w-20 justify-center bg-white/5 border-white/10 text-zinc-400 group-hover/vehicle:text-white transition-colors">{vehicle.type}</Badge>
                                                <span className="font-mono text-lg font-bold text-white tracking-widest group-hover/vehicle:text-primary transition-colors">{vehicle.number}</span>
                                            </Label>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" aria-label="Remove vehicle" className="text-zinc-700 hover:text-red-500 hover:bg-red-500/5" onClick={() => handleRemoveVehicle(index)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </RadioGroup>
                        )}
                        />
                        {vehicleFields.length === 0 && <p className="text-center text-[10px] font-bold text-zinc-700 uppercase tracking-widest py-8 border border-dashed border-white/5 rounded-2xl">No vehicles added.</p>}
                    </div>
                    <FormMessage className="text-red-500 text-[10px]" />
                </FormItem>
            )}
            />

            <div className="space-y-4 pt-4 border-t border-white/5">
                <FormLabel className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Add New Vehicle</FormLabel>
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={newVehicleType} onValueChange={(value) => setNewVehicleType(value as any)}>
                        <SelectTrigger className="w-[140px] bg-black/20 border-white/10 text-white h-10">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#020617] border-white/10 text-white">
                            <SelectItem value="walking">Walking</SelectItem>
                            <SelectItem value="car">Car</SelectItem>
                            <SelectItem value="bike">Bike</SelectItem>
                            <SelectItem value="tempo">Tempo</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input placeholder="Vehicle Number" value={newVehicleNumber} onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())} disabled={newVehicleType === 'walking'} className="flex-1 min-w-[150px] bg-black/20 border-white/10 text-white placeholder:text-zinc-700 h-10 font-mono" />
                    <Button type="button" variant="outline" onClick={handleAddVehicle} className="h-10 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest px-6 ml-auto">
                        <Plus className="mr-2 h-4 w-4" /> Add
                    </Button>
                </div>
            </div>
        </div>
    );
}
