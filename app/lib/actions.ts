'use server';

import {z} from 'zod';
import { sql } from '@vercel/postgres';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({invalid_type_error: 'Please select a customer.'}),
    amount: z.coerce.number().gt(0, {message: 'Please enter a value greater than $0.'}),
    status: z.enum(['pending','paid'], {invalid_type_error: 'Please select the status of the invoice.'}),
    date: z.string(),
});

export type State={
    errors?:{customerId?: string[]; amount?: string[]; status?: string[]};
    message?: string | null;
};

const CreateInvoice= FormSchema.omit({id: true, date: true});

export async function createInvoice(prevState: State, formData: FormData){
    // form validation using zod
    const validateFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    // return errors early for invalid forms
    if(!validateFields.success){
        //console.log(validateFields);
        return{
            errors: validateFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Invoice Creation Failed.'
        };
    }
    // prepare data to insert into the database
    const {customerId, amount, status} = validateFields.data;
    const amountInCents= amount*100;
    const date= new Date().toISOString().split('T')[0];
    // insert data into the database
    try{
        await sql`
        INSERT INTO invoices(customer_id, amount, status, date)
        VALUES (${customerId},${amountInCents},${status},${date})
        `;
    } catch(error){ // return error message if the database operation fails
        return{message: 'Database Error: Failed to Create Invoice.'};
    }
    // revalidate cache for the invoices page and redirect to the invoices page
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({id: true, date: true});

export async function updateInvoice(id: string, prevState: State, formData: FormData){
    const validateFields= UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    if(!validateFields.success){
        return{
            errors: validateFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Invoice Update Failed.'
        };
    }
    const {customerId, amount, status}= validateFields.data;
    const amountInCents=amount*100;

    try{
        await sql`
        UPDATE invoices
        SET customer_id=${customerId}, amount=${amountInCents}, status=${status}
        WHERE id=${id}
        `;
    } catch(error){
        return{message: 'Databse Error: Failed to Update Invoice.'};
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string){
    try{
        await sql`DELETE FROM invoices WHERE id=${id}`;
        revalidatePath('/dashboard/invoices');
        return{message: 'Invoice Deleted.'};
    } catch(error){
        return{message: 'Database Error: Failed to Delete Invoice.'};
    }
}